import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  IsolationLevel,
  ScenarioResult,
  TransactionIsolationService,
} from './transaction-isolation.service';

const ISOLATION_LEVELS: IsolationLevel[] = [
  'READ UNCOMMITTED',
  'READ COMMITTED',
  'REPEATABLE READ',
  'SERIALIZABLE',
];

function parseIsolationLevel(value: string): IsolationLevel {
  const normalized = value?.toUpperCase().replace(/_/g, ' ');
  const level = ISOLATION_LEVELS.find((l) => l.replace(/ /g, '_') === value?.toUpperCase() || l === normalized);
  return level ?? 'REPEATABLE READ';
}

@Controller('transaction-isolation')
export class TransactionIsolationController {
  constructor(private readonly service: TransactionIsolationService) {}

  @Post('reset')
  async reset(): Promise<{ message: string }> {
    return this.service.reset();
  }

  @Get('scenarios/dirty-read')
  async dirtyRead(
    @Query('isolation') isolation?: string,
  ): Promise<ScenarioResult> {
    const level = parseIsolationLevel(isolation ?? 'READ_UNCOMMITTED');
    return this.service.runScenario('dirty-read', level);
  }

  @Get('scenarios/non-repeatable-read')
  async nonRepeatableRead(
    @Query('isolation') isolation?: string,
  ): Promise<ScenarioResult> {
    const level = parseIsolationLevel(isolation ?? 'READ COMMITTED');
    return this.service.runScenario('non-repeatable-read', level);
  }

  @Get('scenarios/phantom-read')
  async phantomRead(
    @Query('isolation') isolation?: string,
  ): Promise<ScenarioResult> {
    const level = parseIsolationLevel(isolation ?? 'REPEATABLE READ');
    return this.service.runScenario('phantom-read', level);
  }

  @Get('scenarios/:name')
  async runScenario(
    @Param('name') name: string,
    @Query('isolation') isolation?: string,
  ): Promise<ScenarioResult> {
    const level = parseIsolationLevel(isolation ?? 'REPEATABLE READ');
    return this.service.runScenario(name, level);
  }
}
