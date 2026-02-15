'use client'

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { WarmupHealth } from '@/lib/queries'

ChartJS.register(ArcElement, Tooltip, Legend)

export default function WarmupChart({ data }: { data: WarmupHealth }) {
  const chartData = {
    labels: ['Healthy (95+)', 'Good (80-94)', 'Warning (<80)'],
    datasets: [
      {
        data: [data.healthy, data.good, data.warning],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
        borderColor: ['#065f46', '#92400e', '#991b1b'],
        borderWidth: 2,
        hoverOffset: 8,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle', padding: 16 },
      },
      tooltip: {
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#94a3b8',
      },
    },
  }

  const total = data.healthy + data.good + data.warning

  return (
    <div
      className="rounded-2xl border p-6"
      style={{
        background: 'linear-gradient(145deg, #1f2937, #111827)',
        borderColor: '#374151',
      }}
    >
      <h3 className="text-lg font-semibold text-white mb-4">Account Warmup Health</h3>
      <div className="relative" style={{ height: 250 }}>
        <Doughnut data={chartData} options={options} />
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginBottom: 40 }}>
          <span className="text-3xl font-bold" style={{ color: data.avgScore >= 90 ? '#10b981' : data.avgScore >= 75 ? '#f59e0b' : '#ef4444' }}>
            {data.avgScore}
          </span>
          <span className="text-xs" style={{ color: '#6b7280' }}>Avg Score</span>
        </div>
      </div>
      <p className="text-center text-xs mt-2" style={{ color: '#6b7280' }}>
        {total} active accounts
      </p>
    </div>
  )
}
