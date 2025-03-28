import { defineEventHandler, getQuery } from 'h3';
import { PrismaClient } from '@prisma/client';
import { fetchBitcoinPrice } from '../index';

const prisma = new PrismaClient();

// Функция для группировки данных по интервалу
type PriceEntry = {
    timestamp: Date;
    price: number;
};

const groupDataByInterval = (prices: PriceEntry[], interval: string): PriceEntry[] => {
    const groupedData: Record<string, { sum: number; count: number; timestamp: Date }> = {};

    prices.forEach((priceEntry) => {
        const timestamp = new Date(priceEntry.timestamp);
        let key: string;

        switch (interval) {
            case 'hour':
                key = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()} ${timestamp.getHours()}:00`;
                break;
            case '8hour':
                const hourGroup = Math.floor(timestamp.getHours() / 8) * 8;
                key = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()} ${hourGroup}:00`;
                break;
            case 'day':
                key = `${timestamp.getFullYear()}-${timestamp.getMonth()}-${timestamp.getDate()}`;
                break;
            case 'month':
                key = `${timestamp.getFullYear()}-${timestamp.getMonth()}`;
                break;
            default:
                key = timestamp.toISOString();
        }

        if (!groupedData[key]) {
            groupedData[key] = { sum: 0, count: 0, timestamp };
        }

        groupedData[key].sum += priceEntry.price;
        groupedData[key].count += 1;
    });

    return Object.values(groupedData).map(({ sum, count, timestamp }) => ({
        timestamp,
        price: sum / count,
    }));
};


export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event);
        const period = query.period || 'day';
        let dateFrom = new Date();
        let dateTo = new Date();
        let interval = 'hour';

        if (period === 'custom' && query.from && query.to) {
            dateFrom = new Date(parseInt(<string>query.from) * 1000);
            dateTo = new Date(parseInt(<string>query.to) * 1000 + 1000 * 3600 * 23);
            const diffDays = Math.floor((dateTo.getTime() - dateFrom.getTime()) / (1000 * 3600 * 24));
            interval = diffDays <= 5 ? '8hour' : 'day';
        } else {
            if (period === 'day') {
                dateFrom.setDate(dateFrom.getDate() - 1);
                interval = 'hour';
            }
            if (period === 'week') {
                dateFrom.setDate(dateFrom.getDate() - 7);
                interval = 'day';
            }
            if (period === 'month') {
                dateFrom.setMonth(dateFrom.getMonth() - 1);
                interval = 'day';
            }
            if (period === 'year') {
                dateFrom.setFullYear(dateFrom.getFullYear() - 1);
                interval = 'month';
            }
        }

        // уникальные даты в указанном периоде
        const existingDates: { timestamp: Date }[] = await prisma.price.findMany({
            where: {
                timestamp: {
                    gte: dateFrom,
                    lte: dateTo,
                },
            },
            select: { timestamp: true },
            distinct: ['timestamp'], // Убираем дубликаты
        });

        // преобразум даты
        const storedDays = new Set(
            existingDates.map((entry: { timestamp: Date }) =>
                entry.timestamp.toISOString().split('T')[0]
            )
        );

        // полный список дней, который должен быть в базе
        const requiredDays = new Set<string>();
        for (let d = new Date(dateFrom); d <= dateTo; d.setDate(d.getDate() + 1)) {
            requiredDays.add(d.toISOString().split('T')[0]);
        }

        const missingDays = [...requiredDays].filter((day) => !storedDays.has(day));

        if (missingDays.length > 0) {
            if (period === 'custom' && query.from && query.to) {
                await fetchBitcoinPrice('custom', query.from, query.to);
            } else {
                await fetchBitcoinPrice(period);
            }
        }

        let prices = await prisma.price.findMany({
            where: {
                timestamp: {
                    gte: dateFrom,
                    lte: dateTo,
                },
            },
            orderBy: { timestamp: 'asc' },
        });

        prices = groupDataByInterval(prices, interval);
        return prices;
    } catch (error) {
        return { error: "Ошибка получения данных", details: error };
    }
});
