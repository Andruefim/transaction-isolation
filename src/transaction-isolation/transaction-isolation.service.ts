import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from './entities/account.entity';

export type IsolationLevel =
  | 'READ UNCOMMITTED'
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

export interface StepResult {
  step: string;
  transaction: string;
  description: string;
  data?: unknown;
}

export interface ScenarioResult {
  scenario: string;
  isolationLevel: IsolationLevel;
  stepResults: StepResult[];
  summary: string;
}

@Injectable()
export class TransactionIsolationService {
  constructor(private readonly dataSource: DataSource) {}

  async reset(): Promise<{ message: string }> {
    await this.dataSource.getRepository(Account).clear();
    await this.dataSource.getRepository(Account).save([
      { name: 'Account A', balance: 1000 },
      { name: 'Account B', balance: 500 },
    ]);
    return { message: 'Demo data reset: 2 accounts (Account A: 1000, Account B: 500)' };
  }

  async runDirtyReadScenario(isolationLevel: IsolationLevel): Promise<ScenarioResult> {
    const stepResults: StepResult[] = [];
    const repo = this.dataSource.getRepository(Account);

    const existing = await repo.find();
    if (existing.length === 0) {
      await this.reset();
    }

    const accountA = await repo.findOne({ where: { name: 'Account A' } });
    if (!accountA) {
      return {
        scenario: 'dirty-read',
        isolationLevel,
        stepResults: [],
        summary: 'Account A not found. Call POST /transaction-isolation/reset first.',
      };
    }

    // 1. Initial state
    const initialBalance = Number(accountA.balance);
    stepResults.push({
      step: '1',
      transaction: 'initial',
      description: 'Initial state: Account A balance',
      data: { balance: initialBalance },
    });

    const runnerA = this.dataSource.createQueryRunner();
    const runnerB = this.dataSource.createQueryRunner();
    await runnerA.connect();
    await runnerB.connect();

    let readInB: number | null = null;

    try {
      // 2. Transaction A updates (uncommitted; will roll back later)
      await runnerA.startTransaction();
      const txRepoA = runnerA.manager.getRepository(Account);
      await txRepoA.update({ name: 'Account A' }, { balance: 999 });
      stepResults.push({
        step: '2',
        transaction: 'A',
        description: 'Transaction A: set Account A balance to 999 (uncommitted)',
        data: { balance: 999 },
      });

      // 3. Transaction B reads with chosen isolation level
      await runnerB.query(
        `SET SESSION TRANSACTION ISOLATION LEVEL ${isolationLevel}`,
      );
      await runnerB.startTransaction();
      const txRepoB = runnerB.manager.getRepository(Account);
      const row = await txRepoB.findOne({ where: { name: 'Account A' } });
      readInB = row ? Number(row.balance) : null;
      await runnerB.commitTransaction();

      stepResults.push({
        step: '3',
        transaction: 'B',
        description: `Transaction B (${isolationLevel}): read Account A balance`,
        data: { balance: readInB },
      });
    } finally {
      await runnerA.rollbackTransaction();
      await runnerA.release();
      await runnerB.release();
    }

    // 4. After Transaction A rolled back: final state
    const afterRollback = await repo.findOne({ where: { name: 'Account A' } });
    const finalBalance = afterRollback ? Number(afterRollback.balance) : null;
    stepResults.push({
      step: '4',
      transaction: 'final',
      description: 'After Transaction A rolled back: Account A balance',
      data: { balance: finalBalance },
    });

    const dirtyReadOccurred = readInB === 999 && finalBalance === initialBalance;
    const summary = dirtyReadOccurred
      ? `Dirty read occurred: Transaction B saw uncommitted value 999; after rollback balance is ${finalBalance}.`
      : `No dirty read: Transaction B saw ${readInB}; final balance ${finalBalance}.`;

    return {
      scenario: 'dirty-read',
      isolationLevel,
      stepResults,
      summary,
    };
  }

  async runNonRepeatableReadScenario(isolationLevel: IsolationLevel): Promise<ScenarioResult> {
    const stepResults: StepResult[] = [];
    const repo = this.dataSource.getRepository(Account);
    const runnerA = this.dataSource.createQueryRunner();
    const runnerB = this.dataSource.createQueryRunner();
    await runnerA.connect();
    await runnerB.connect();
  
    try {
      // 1. Initial State
      const accountA = await repo.findOne({ where: { name: 'Account A' } });
      if (!accountA) {
        throw new Error('Account A not found');
      }
      const initialBalance = Number(accountA.balance);
      stepResults.push({ step: '1', transaction: 'initial', description: 'Account A balance', data: { balance: initialBalance } });

      // 2. Transaction B starts and reads
      await runnerB.query(`SET SESSION TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      await runnerB.startTransaction();
      const row1 = await runnerB.manager.findOne(Account, { where: { name: 'Account A' } });
      if (!row1) {
        throw new Error('Account A not found');
      }
      const firstReadB = Number(row1.balance);
      stepResults.push({ step: '2', transaction: 'B', description: `B reads first time (${isolationLevel})`, data: { balance: firstReadB } });
  
      // 3. Transaction A updates and COMMITS
      await runnerA.startTransaction();
      await runnerA.manager.update(Account, { name: 'Account A' }, { balance: 888 });
      await runnerA.commitTransaction();
      stepResults.push({ step: '3', transaction: 'A', description: 'A updates balance to 888 and COMMITS' });
  
      // 4. Transaction B reads AGAIN
      const row2 = await runnerB.manager.findOne(Account, { where: { name: 'Account A' } });
      if (!row2) {
        throw new Error('Account A not found');
      }
      const secondReadB = Number(row2.balance);
      await runnerB.commitTransaction();
      
      stepResults.push({ step: '4', transaction: 'B', description: `B reads second time (${isolationLevel})`, data: { balance: secondReadB } });
  
      const occurred = firstReadB !== secondReadB;
      return {
        scenario: 'non-repeatable-read',
        isolationLevel,
        stepResults,
        summary: occurred 
          ? `Non-repeatable read occurred! B saw ${firstReadB} then ${secondReadB}.`
          : `Repeatable read maintained: B saw ${firstReadB} both times.`
      };
    } finally {
      await runnerA.release();
      await runnerB.release();
    }
  }

  async runScenario(
    scenario: string,
    isolationLevel: IsolationLevel,
  ): Promise<ScenarioResult> {
    if (scenario === 'dirty-read') {
      return this.runDirtyReadScenario(isolationLevel);
    }
    if (scenario === 'non-repeatable-read') {
      return this.runNonRepeatableReadScenario(isolationLevel);
    }
    return {
      scenario,
      isolationLevel,
      stepResults: [],
      summary: `Scenario "${scenario}" not implemented yet.`,
    };
  }
}
