import csvParse from 'csv-parse';
import fs from 'fs';
import { getCustomRepository, getRepository, In } from 'typeorm';
import TransactionsRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface CsvTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const readStream = fs.createReadStream(filePath);

    const parser = csvParse({
      from_line: 2,
      trim: true
    });

    const parseCsv = readStream.pipe(parser);

    const transactions: CsvTransaction[] = [];
    const categories: string[] = [];

    parseCsv.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCsv.on('end', resolve));

    const allExistingCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    const allCategoriesTitles = allExistingCategories.map(
      (category: Category) => category.title,
    );

    const addInexistingCategories = categories
      .filter(category => !allCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addInexistingCategories.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories);

    const allCategories = [...newCategories, ...allExistingCategories];

    const parsedTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: allCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(parsedTransactions);
    await fs.promises.unlink(filePath);

    return parsedTransactions;
  }
}

export default ImportTransactionsService;
