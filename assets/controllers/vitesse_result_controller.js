import { Controller } from '@hotwired/stimulus'

const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#db2777', '#7c3aed']

export default class extends Controller {
    static targets = ['canvas']
    static values  = { series: Array, vmaTargetPct: Number }

    connect() {
        const collapse = this.element.closest('.accordion-collapse')
        if (collapse && !collapse.classList.contains('show')) {
            collapse.addEventListener('shown.bs.collapse', () => this._init(), { once: true })
        } else {
            this._init()
        }
    }

    disconnect() {
        if (this._chart) { this._chart.destroy(); this._chart = null }
    }

    _init() {
        if (!window.Chart || !this.hasCanvasTarget) return
        const series = this.seriesValue
        if (!series.length) return

        const vmaPct = this.vmaTargetPctValue || 70
        const maxP   = Math.max(...series.map(s => s.passages.length))
        const labels = Array.from({ length: maxP }, (_, i) => `P${i + 1}`)

        const datasets = []
        series.forEach((s, idx) => {
            const color = COLORS[idx % COLORS.length]
            datasets.push({
                label: s.fullName,
                data: Array.from({ length: maxP }, (_, i) =>
                    s.passages[i] != null ? s.passages[i].kmh : null
                ),
                borderColor: color,
                backgroundColor: color + '22',
                pointBackgroundColor: color,
                pointRadius: 5,
                pointHoverRadius: 7,
                tension: 0.3,
                fill: false,
                spanGaps: false,
            })
            if (s.vmaKmh) {
                const target = Math.round(s.vmaKmh * vmaPct / 10) / 10
                datasets.push({
                    label: `Cible ${s.fullName.split(' ')[0]} (${target} km/h)`,
                    data: Array(maxP).fill(target),
                    borderColor: color,
                    borderDash: [6, 3],
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false,
                    tension: 0,
                })
            }
        })

        this._chart = new window.Chart(this.canvasTarget, {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 11 }, padding: 10 },
                    },
                    tooltip: {
                        callbacks: {
                            label: ctx => `${ctx.dataset.label} : ${ctx.parsed.y ?? '—'} km/h`,
                        },
                    },
                },
                scales: {
                    x: {
                        title: { display: true, text: 'Passage', font: { size: 11 }, color: '#6c757d' },
                        grid: { color: '#e9ecef' },
                        ticks: { font: { size: 11 } },
                    },
                    y: {
                        title: { display: true, text: 'Vitesse (km/h)', font: { size: 11 }, color: '#6c757d' },
                        grid: { color: '#e9ecef' },
                        ticks: { font: { size: 11 }, callback: v => v + ' km/h' },
                    },
                },
            },
        })
    }
}
