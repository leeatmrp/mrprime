'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { DailyDataPoint } from '@/lib/queries'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

export default function DailyChart({ data }: { data: DailyDataPoint[] }) {
  const labels = data.map(d => {
    const date = new Date(d.date + 'T00:00:00')
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Leads Contacted',
        data: data.map(d => d.sent),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: true,
        yAxisID: 'y',
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
      {
        label: 'Replies',
        data: data.map(d => d.replies),
        borderColor: '#06b6d4',
        backgroundColor: 'rgba(6, 182, 212, 0.1)',
        fill: false,
        yAxisID: 'y1',
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
      {
        label: 'Opportunities',
        data: data.map(d => d.opportunities),
        borderColor: '#ec4899',
        backgroundColor: 'rgba(236, 72, 153, 0.1)',
        fill: false,
        yAxisID: 'y1',
        tension: 0.3,
        pointRadius: 2,
        pointHoverRadius: 5,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle' },
      },
      tooltip: {
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#94a3b8',
      },
    },
    scales: {
      x: {
        ticks: { color: '#6b7280', maxRotation: 45 },
        grid: { color: 'rgba(55, 65, 81, 0.3)' },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        title: { display: true, text: 'Leads Contacted', color: '#f97316' },
        ticks: { color: '#6b7280' },
        grid: { color: 'rgba(55, 65, 81, 0.3)' },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        title: { display: true, text: 'Replies / Opps', color: '#06b6d4' },
        ticks: { color: '#6b7280' },
        grid: { drawOnChartArea: false },
      },
    },
  }

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        background: 'linear-gradient(145deg, #1f2937, #111827)',
        borderColor: '#374151',
      }}
    >
      <h3 className="text-lg font-semibold text-white mb-4">Daily Performance (Last {data.length} Days)</h3>
      <div style={{ height: 300 }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
