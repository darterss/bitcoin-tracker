import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_URL = 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range';

async function fetchBitcoinPrice(period, customFrom, customTo) {
    try {
        // Определяем временной диапазон
        let dateTo = Math.floor(Date.now() / 1000); // Текущая дата в UNIX
        let dateFrom = dateTo;

        if (period === 'day') dateFrom -= 86400; // 1 день назад и т.д.
        else if (period === 'week') dateFrom -= 86400 * 7;
        else if (period === 'month') dateFrom -= 86400 * 30;
        else if (period === 'year') dateFrom -= 86400 * 365;
        else if (period === 'custom') {

            if (!customFrom || !customTo) {
                throw new Error('неправильно выбраны даты');
            }
            dateFrom = customFrom;
            dateTo = customTo;
        } else {
            throw new Error('неправильный период');
        }

        const response = await axios.get(API_URL, {
            params: {
                vs_currency: 'usd',
                from: dateFrom,
                to: dateTo
            }
        });

        const prices = response.data.prices;

        // Сохраняем данные в базу
        for (const priceData of prices) {
            const timestamp = new Date(priceData[0]);
            const price = priceData[1];

            try {
                await prisma.price.upsert({
                    where: {
                        timestamp_price: { timestamp, price } // уникальный ключ
                    },
                    update: {},
                    create: { timestamp, price }
                });
            } catch (error) {
                console.error("Ошибка при сохранении данных:", error);
            }
        }
    } catch (error) {
        console.error('Ошибка при получении данных:', error.message);
    }
}

export { fetchBitcoinPrice };
