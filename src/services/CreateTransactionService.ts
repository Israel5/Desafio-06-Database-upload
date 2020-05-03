import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const { total } = await transactionsRepository.getBalance();
    if (type === 'outcome' && total < value) {
      throw new AppError('Insufficient funds');
    }

    const categoryRepository = getRepository(Category);
    let categoryTopic = await categoryRepository.findOne({
      where: { title: category },
    });

    if (!categoryTopic) {
      categoryTopic = categoryRepository.create({ title: category });
      await categoryRepository.save(categoryTopic);
    }

    const transaction = transactionsRepository.create({
      title,
      value,
      type,
      category: categoryTopic,
    });

    await transactionsRepository.save(transaction);
    return transaction;
  }
}

export default CreateTransactionService;
