import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { TransactionIsolationController } from './transaction-isolation.controller';
import { TransactionIsolationService } from './transaction-isolation.service';

@Module({
  imports: [TypeOrmModule.forFeature([Account])],
  controllers: [TransactionIsolationController],
  providers: [TransactionIsolationService],
})
export class TransactionIsolationModule {}
