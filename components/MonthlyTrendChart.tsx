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
import annotationPlugin from 'chartjs-plugin-annotation'
import { Line } from 'react-chartjs-2'
import { ReportingMonthlyRow } from '@/lib/queries'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler, annotationPlugin)

export default function MonthlyTrendChart({ data }: { data: ReportingMonthlyRow[] }) {
  const labels = data.map(d => {
    const date = new Date(d.month + 'T00:00:00')
    return date.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
  })

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Leads Contacted',
        data: data.map(d => d.total_lead_contacted),
        borderColor: '#f97316',
        backgroundColor: 'rgba(249, 115, 22, 0.1)',
        fill: true,
        yAxisID: 'y',
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: 'Reply Rate %',
        data: data.map(d => d.reply_rate),
        borderColor: '#06b6d4',
        backgroundColor: 'transparent',
        fill: false,
        yAxisID: 'y1',
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
      },
      {
        label: 'PRR %',
        data: data.map(d => d.prr),
        borderColor: '#8b5cf6',
        backgroundColor: 'transparent',
        fill: false,
        yAxisID: 'y1',
        tension: 0.3,
        pointRadius: 3,
        pointHoverRadius: 6,
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
        labels: { color: '#94a3b8', usePointStyle: true, pointStyle: 'circle' as const },
      },
      tooltip: {
        backgroundColor: '#1f2937',
        borderColor: '#374151',
        borderWidth: 1,
        titleColor: '#fff',
        bodyColor: '#94a3b8',
      },
      annotation: {
        annotations: {
          replyRateGoal: {
            type: 'line' as const,
            yMin: 1,
            yMax: 1,
            yScaleID: 'y1',
            borderColor: 'rgba(6, 182, 212, 0.4)',
            borderWidth: 1,
            borderDash: [6, 4],
            label: {
              display: true,
              content: 'RR Goal 1%',
              position: 'start' as const,
              color: '#06b6d4',
              font: { size: 10 },
              backgroundColor: 'transparent',
            },
          },
          prrGoal: {
            type: 'line' as const,
            yMin: 15,
            yMax: 15,
            yScaleID: 'y1',
            borderColor: 'rgba(139, 92, 246, 0.4)',
            borderWidth: 1,
            borderDash: [6, 4],
            label: {
              display: true,
              content: 'PRR Goal 15%',
              position: 'start' as const,
              color: '#8b5cf6',
              font: { size: 10 },
              backgroundColor: 'transparent',
            },
          },
        },
      },
    },
    scales: {
      x: {
        ticks: { color: '#6b7280' },
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
        title: { display: true, text: 'Rate %', color: '#06b6d4' },
        ticks: { color: '#6b7280' },
        grid: { drawOnChartArea: false },
        min: 0,
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
      <h3 className="text-lg font-semibold text-white mb-4">Monthly Trends</h3>
      <div style={{ height: 350 }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  )
}
