<script setup>
import { ref, onMounted } from 'vue';
import { Chart } from 'chart.js/auto';

const period = ref('day');
const fromDate = ref(null);
const toDate = ref(null);
const prices = ref([]);
const chartCanvas = ref(null);
const isLoading = ref(false);
let chartInstance = null;

const today = computed(() => new Date().toISOString().split("T")[0]);

const fetchData = async () => {
  if (period.value === "custom" && (!fromDate.value || !toDate.value)) {
    return;
  }

  let diffDays;
  try {
    isLoading.value = true;

    let url = `/api/prices?period=${period.value}`;

    if (period.value === "custom") {
      const fromTimestamp = Math.floor(new Date(fromDate.value).getTime() / 1000);
      const toTimestamp = Math.floor(new Date(toDate.value).getTime() / 1000);
      diffDays = (toTimestamp - fromTimestamp) / (3600 * 24);
      url = `/api/prices?period=custom&from=${fromTimestamp}&to=${toTimestamp}`;
    }

    const response = await fetch(url);
    const json = await response.json();

    if (Array.isArray(json) && json.length > 0) {
      prices.value = json;

      let labels = [];
      if (period.value === "day") {
        labels = prices.value.map((p) => new Date(p.timestamp).toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit"
        }));
      } else if (period.value === "week" || period.value === "month") {
        labels = prices.value.map((p) => new Date(p.timestamp).toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit"
        }));
      } else if (period.value === "year") {
        labels = prices.value.map((p) => new Date(p.timestamp).toLocaleDateString("ru-RU", {
          month: "long",
          year: "numeric"
        }));
      } else if (period.value === "custom") {
        labels = prices.value.map((p) => new Date(p.timestamp).toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: diffDays > 5 ? "2-digit" : undefined,
          hour: diffDays > 5 ? undefined : "2-digit",
          minute: diffDays > 5 ? undefined : "2-digit"
        }));
      }

      if (chartInstance) chartInstance.destroy();

      chartInstance = new Chart(chartCanvas.value, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Цена BTC, $",
              data: prices.value.map((p) => p.price),
              borderColor: "rgb(75, 192, 192)",
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              tension: 0.1,
            },
          ],
        },
      });
    } else {
      console.warn("нет данных", json);
    }
  } catch (error) {
    console.error("ошибка при загрузке данных:", error);
  } finally {
    isLoading.value = false;
  }
};
onMounted(fetchData);
</script>

<template>
  <div class="flex flex-col items-center p-6 bg-gray-100 min-h-screen">
    <h1 class="text-3xl font-bold text-gray-800 mb-6">График цены Bitcoin</h1>

    <!-- Выбор периода -->
    <select v-model="period" @change="fetchData"
            class="px-4 py-2 border border-gray-300 rounded-lg shadow-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4">
      <option value="day">День</option>
      <option value="week">Неделя</option>
      <option value="month">Месяц</option>
      <option value="year">Год</option>
      <option value="custom">Произвольный</option>
    </select>

    <!-- Выбор даты для кастомного периода -->
    <div v-if="period === 'custom'" class="flex gap-4 mb-4">
      <input type="date" v-model="fromDate"
             :max="today"
             class="px-4 py-2 border border-gray-300 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500">
      <input type="date" v-model="toDate"
             :max="today"
             class="px-4 py-2 border border-gray-300 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500">
      <button @click="fetchData" :disabled="!fromDate || !toDate || new Date(fromDate).getTime() > new Date(toDate).getTime()"
              class="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 disabled:bg-gray-400">
        Применить
      </button>
    </div>

    <div class="bg-white p-4 rounded-lg shadow-lg w-full max-w-4xl relative">
      <!-- Индикатор загрузки -->
      <div v-if="isLoading"
           class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 text-lg font-semibold text-gray-700">
        Загрузка данных...
      </div>

      <canvas ref="chartCanvas" :class="{ 'opacity-50 transition-opacity': isLoading }"></canvas>
    </div>
  </div>
</template>
