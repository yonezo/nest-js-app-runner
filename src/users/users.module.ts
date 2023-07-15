import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  exports: [TypeOrmModule], // 他のモジュールで User Entity を使えるようにする
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
