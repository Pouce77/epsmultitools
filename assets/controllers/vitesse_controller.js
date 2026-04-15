import { Controller } from '@hotwired/stimulus'
import { showAlert, showConfirm, showSaveDialog } from '../utils/dialog.js'

export default class extends Controller {
    static targets = [
        // Desktop timer card
        'desktopTimer', 'timerDisplay', 'startBtn', 'lapBtn', 'stopBtn', 'currentStudent',
        // Config
        'plotInput', 'trackInput', 'vmaTargetInput', 'saveBtn',
        // Table
        'tableBody', 'tableHint',
        // Chart
        'chartContainer', 'chartCanvas', 'chartPlaceholder',
        // Tablet overlay
        'tabletOverlay', 'tabletToggleBtn',
        'tabletStudentName', 'tabletInfo',
        'tabletPassageList', 'tabletResult', 'tabletResultSpeed', 'tabletResultBadge',
        'tabletButtons', 'tabletStartBtn', 'tabletLapBtn', 'tabletStopBtn',
    ]
    static values = { eleves: Array, classeId: Number }

    connect() {
        this.running = false
        this.tabletMode = false
        this.startTime = null
        this.lastSplitTime = null
        this.interval = null
        this.selectedIndex = null
        this.results = {}   // { eleveId: { passages: [{splitTime, ms, kmh}] } }
        this.vmaStore = {}  // { eleveId: vma_kmh }
        // Initialiser depuis les données serveur (persistées en base)
        this.elevesValue.forEach(e => { if (e.vma) this.vmaStore[e.id] = e.vma })
        this._chart = null
        this.renderTable()
    }

    disconnect() {
        clearInterval(this.interval)
        if (this._chart) { this._chart.destroy(); this._chart = null }
    }

    // ── Helpers ────────────────────────────────────────────────────────

    getPlotDistance() { return parseFloat(this.plotInputTarget.value) || 20 }
    getVmaTargetPct() { return parseFloat(this.vmaTargetInputTarget.value) || 70 }

    /** Update all timerDisplay targets (desktop + tablet) */
    _setTimer(text) {
        this.timerDisplayTargets.forEach(el => { el.textContent = text })
    }

    /** Sync Start/Passage/Stop buttons in both views */
    _syncButtons(running) {
        this.startBtnTarget.disabled = running
        this.lapBtnTarget.disabled = !running
        this.stopBtnTarget.disabled = !running
        this.tabletStartBtnTarget.disabled = running
        this.tabletLapBtnTarget.disabled = !running
        this.tabletStopBtnTarget.disabled = !running
    }

    // ── Tablet mode ────────────────────────────────────────────────────

    toggleTablet() {
        this.tabletMode = !this.tabletMode
        const btn = this.tabletToggleBtnTarget
        if (this.tabletMode) {
            btn.classList.replace('btn-outline-primary', 'btn-primary')
            this.tableHintTarget.querySelector('small').innerHTML =
                '<i class="bi bi-tablet me-1"></i><strong>Mode tablette actif</strong> — cliquez sur un élève pour ouvrir l\'interface de chronométrage'
        } else {
            btn.classList.replace('btn-primary', 'btn-outline-primary')
            this.tableHintTarget.querySelector('small').innerHTML =
                'Cliquez sur un élève pour le sélectionner · Saisissez sa VMA (km/h) · <strong>Passage</strong> à chaque plot, <strong>Arrêter</strong> au dernier'
        }
    }

    openTabletOverlay(eleve) {
        // Populate student info
        this.tabletStudentNameTarget.innerHTML =
            `${eleve.fullName} `
            + (eleve.sexe === 'M' ? '<span class="badge bg-info bg-opacity-25 text-info border">M</span>' :
               eleve.sexe === 'F' ? '<span class="badge bg-danger bg-opacity-25 text-danger border">F</span>' : '')

        const vma = this.vmaStore[eleve.id]
        const vmaPct = this.getVmaTargetPct()
        if (vma && vma > 0) {
            const cible = (vma * vmaPct / 100).toFixed(1)
            this.tabletInfoTarget.textContent = `VMA : ${vma} km/h · Cible : ${vmaPct}% → ${cible} km/h`
        } else {
            this.tabletInfoTarget.textContent = 'VMA non renseignée — saisissez-la dans le tableau'
        }

        // Reset passage list and result panel
        this.tabletPassageListTarget.innerHTML = ''
        this.tabletResultTarget.style.display = 'none'
        this.tabletButtonsTarget.style.display = 'flex'
        this._setTimer('00:00.0')
        this._syncButtons(false)

        this.tabletOverlayTarget.style.display = 'flex'
        // Prevent body scroll while overlay is open
        document.body.style.overflow = 'hidden'
    }

    async closeTablet() {
        if (this.running) {
            if (!await showConfirm('Un chrono est en cours. Abandonner la mesure ?', { title: 'Chrono actif', confirmLabel: 'Abandonner' })) return
            clearInterval(this.interval)
            this.running = false
            this._setTimer('00:00.0')
            this._syncButtons(false)
            this.currentStudentTarget.textContent = 'Sélectionnez un élève ci-dessous'
            this.selectedIndex = null
        }
        this.tabletOverlayTarget.style.display = 'none'
        document.body.style.overflow = ''
    }

    // ── Student selection ──────────────────────────────────────────────

    selectEleve(index) {
        if (this.running) return
        this.selectedIndex = index
        const eleve = this.elevesValue[index]

        if (this.tabletMode) {
            this.openTabletOverlay(eleve)
        } else {
            this.currentStudentTarget.textContent = `Élève sélectionné : ${eleve.fullName}`
            this.renderTable()
        }
    }

    // ── Timer actions ──────────────────────────────────────────────────

    async start() {
        if (this.running) return
        if (this.selectedIndex === null) {
            await showAlert('Sélectionnez d\'abord un élève dans le tableau.', { title: 'Aucun élève sélectionné', type: 'info' })
            return
        }
        this.running = true
        const now = performance.now()
        this.startTime = now
        this.lastSplitTime = now

        const eleve = this.elevesValue[this.selectedIndex]
        this.results[eleve.id] = { passages: [] }

        this._syncButtons(true)
        if (!this.tabletMode) {
            this.currentStudentTarget.textContent = `Élève sélectionné : ${eleve.fullName}`
        }

        this.interval = setInterval(() => {
            const elapsed = (performance.now() - this.startTime) / 1000
            this._setTimer(this.formatTime(elapsed))
        }, 100)
    }

    lap() {
        if (!this.running) return
        const now = performance.now()
        const splitTime = (now - this.lastSplitTime) / 1000
        if (splitTime < 0.5) return // ignore accidental double-click

        this.lastSplitTime = now
        const passage = this._recordPassage(splitTime)
        const eleve = this.elevesValue[this.selectedIndex]
        const n = this.results[eleve.id].passages.length

        if (this.tabletMode) {
            this._addTabletPassageLine(n, passage)
        }
        this.renderTable()
    }

    stop() {
        if (!this.running) return
        clearInterval(this.interval)
        this.running = false

        const now = performance.now()
        const splitTime = (now - this.lastSplitTime) / 1000
        if (splitTime >= 0.5) {
            this._recordPassage(splitTime)
        }

        this._syncButtons(false)

        if (this.tabletMode) {
            this._showTabletResult()
        } else {
            this._setTimer('00:00.0')
            this.currentStudentTarget.textContent = 'Sélectionnez un élève ci-dessous'
            this.selectedIndex = null
        }
        this.renderTable()
    }

    // ── Internal helpers ───────────────────────────────────────────────

    _recordPassage(splitTime) {
        const ms = this.getPlotDistance() / splitTime
        const kmh = ms * 3.6
        const eleve = this.elevesValue[this.selectedIndex]
        const passage = { splitTime, ms, kmh }
        this.results[eleve.id].passages.push(passage)
        return passage
    }

    _addTabletPassageLine(num, passage) {
        const div = document.createElement('div')
        div.className = 'fw-semibold'
        div.style.color = '#facc15'
        div.textContent = `Passage ${num} — ${passage.kmh.toFixed(1)} km/h`
        this.tabletPassageListTarget.prepend(div)
    }

    _showTabletResult() {
        const eleve = this.elevesValue[this.selectedIndex]
        const passages = this.results[eleve.id]?.passages || []
        const vma = this.vmaStore[eleve.id]
        const vmaPct = this.getVmaTargetPct()

        this.tabletButtonsTarget.style.display = 'none'
        this.tabletResultTarget.style.display = 'block'

        let html = ''
        if (passages.length > 0) {
            const avgKmh = passages.reduce((s, p) => s + p.kmh, 0) / passages.length
            this.tabletResultSpeedTarget.textContent = `V. moy. : ${avgKmh.toFixed(1)} km/h`

            if (vma && vma > 0) {
                const pct = (avgKmh / vma * 100).toFixed(0)
                const ok = avgKmh >= vma * (vmaPct / 100)
                html = ok
                    ? `<span class="badge bg-success" style="font-size:2rem;padding:.6rem 1.5rem">✓ Contrat respecté (${pct}%)</span>`
                    : `<span class="badge bg-danger"  style="font-size:2rem;padding:.6rem 1.5rem">✗ Contrat non respecté (${pct}%)</span>`
            } else {
                html = '<span class="text-secondary">VMA non renseignée — contrat non calculable</span>'
            }
        } else {
            this.tabletResultSpeedTarget.textContent = 'Aucun passage enregistré'
        }
        this.tabletResultBadgeTarget.innerHTML = html
        this.selectedIndex = null
    }

    // ── Table ──────────────────────────────────────────────────────────

    renderTable() {
        const tbody = this.tableBodyTarget
        tbody.innerHTML = ''
        const vmaTargetPct = this.getVmaTargetPct()

        this.elevesValue.forEach((eleve, i) => {
            const passages = this.results[eleve.id]?.passages || []
            const vma = this.vmaStore[eleve.id] || ''
            const selected = this.selectedIndex === i

            let avgKmh = null, lastKmh = null, vmaPercent = null, contrat = null
            if (passages.length > 0) {
                lastKmh = passages[passages.length - 1].kmh
                avgKmh = passages.reduce((s, p) => s + p.kmh, 0) / passages.length
                if (vma && vma > 0) {
                    vmaPercent = (avgKmh / vma) * 100
                    contrat = avgKmh >= vma * (vmaTargetPct / 100)
                }
            }

            const row = document.createElement('tr')
            row.dataset.index = i
            row.style.cursor = 'pointer'
            if (selected) row.classList.add('table-primary')

            row.innerHTML = `
                <td>
                    <span class="fw-semibold">${eleve.fullName}</span>
                    ${eleve.sexe === 'M' ? '<span class="badge bg-info bg-opacity-10 text-info border ms-1">M</span>' :
                      eleve.sexe === 'F' ? '<span class="badge bg-danger bg-opacity-10 text-danger border ms-1">F</span>' : ''}
                </td>
                <td class="text-center" style="width:85px">
                    <input type="number"
                           class="form-control form-control-sm text-center p-1"
                           style="width:72px;margin:auto"
                           placeholder="ex: 14" step="0.1" min="0" max="30"
                           value="${vma}"
                           data-action="change->vitesse#updateVma"
                           data-eleve-id="${eleve.id}">
                </td>
                <td class="text-center fw-semibold text-muted">${passages.length > 0 ? passages.length : '—'}</td>
                <td class="text-center fw-bold ${lastKmh !== null ? 'text-primary' : 'text-muted'}">
                    ${lastKmh !== null ? lastKmh.toFixed(1) : '—'}
                </td>
                <td class="text-center fw-bold ${avgKmh !== null ? 'text-info' : 'text-muted'}">
                    ${avgKmh !== null ? avgKmh.toFixed(1) : '—'}
                </td>
                <td class="text-center fw-bold ${vmaPercent !== null ? (contrat ? 'text-success' : 'text-danger') : 'text-muted'}">
                    ${vmaPercent !== null ? vmaPercent.toFixed(0) + '%' : '—'}
                </td>
                <td class="text-center">
                    ${vmaPercent !== null
                        ? (contrat
                            ? '<span class="badge bg-success px-2 py-1 fs-6">✓</span>'
                            : '<span class="badge bg-danger px-2 py-1 fs-6">✗</span>')
                        : ''}
                </td>
                <td class="text-center">
                    ${passages.length > 0
                        ? `<button class="btn btn-sm btn-outline-danger py-0"
                                   data-action="vitesse#clearResult"
                                   data-index="${i}">✕</button>`
                        : ''}
                </td>
            `
            row.addEventListener('click', (e) => {
                if (!e.target.closest('button, input')) this.selectEleve(i)
            })
            tbody.appendChild(row)
        })
        this._renderChart()
    }

    // ── Graphique ──────────────────────────────────────────────────────

    _renderChart() {
        if (!window.Chart) return

        const COLORS = ['#0f9e8e','#e84020','#6366f1','#f5b800','#ec4899','#f97316','#14b8a6','#8b5cf6']
        const vmaPct = this.getVmaTargetPct()

        // Collect students with at least one passage
        const series = []
        this.elevesValue.forEach(eleve => {
            const passages = this.results[eleve.id]?.passages || []
            if (passages.length === 0) return
            series.push({ eleve, passages, vma: this.vmaStore[eleve.id] || null })
        })

        // Placeholder visible si pas de données, graphique masqué
        const hasData = series.length > 0
        this.chartPlaceholderTarget.style.display = hasData ? 'none' : ''
        this.chartCanvasTarget.style.display      = hasData ? 'block' : 'none'
        if (!hasData) {
            if (this._chart) { this._chart.destroy(); this._chart = null }
            return
        }

        const maxP = Math.max(...series.map(s => s.passages.length))
        const labels = Array.from({ length: maxP }, (_, i) => `P${i + 1}`)

        const datasets = []
        series.forEach((s, idx) => {
            const color = COLORS[idx % COLORS.length]
            // Passage speeds line
            datasets.push({
                label: s.eleve.fullName,
                data: Array.from({ length: maxP }, (_, i) =>
                    s.passages[i] ? Math.round(s.passages[i].kmh * 10) / 10 : null
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
            // VMA target dashed line
            if (s.vma && s.vma > 0) {
                const target = Math.round(s.vma * vmaPct / 10) / 10
                datasets.push({
                    label: `Cible ${s.eleve.prenom ?? s.eleve.fullName.split(' ')[0]} (${target} km/h)`,
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

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { size: 11 }, padding: 12 },
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
        }

        if (this._chart) {
            this._chart.data.labels   = labels
            this._chart.data.datasets = datasets
            this._chart.update()
        } else {
            this._chart = new window.Chart(this.chartCanvasTarget.getContext('2d'), {
                type: 'line',
                data: { labels, datasets },
                options: chartOptions,
            })
        }
    }

    updateVma(event) {
        const eleveId = parseInt(event.target.dataset.eleveId)
        const vma = parseFloat(event.target.value)
        if (vma > 0) {
            this.vmaStore[eleveId] = vma
        } else {
            delete this.vmaStore[eleveId]
        }
        this._persistVma(eleveId, vma > 0 ? vma : null)
        this.renderTable()
    }

    _persistVma(eleveId, vma) {
        const eleve = this.elevesValue.find(e => e.id === eleveId)
        if (!eleve) return
        // Trouver la classe depuis l'URL courante (/outils/{classeId}/vitesse)
        const classeId = this.classeIdValue
        fetch(`/classes/${classeId}/eleves/${eleveId}/vma`, {
            method: 'PATCH',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vma }),
        }).catch(() => { /* échec silencieux, valeur déjà en mémoire */ })
    }

    clearResult(event) {
        event.stopPropagation()
        const index = parseInt(event.currentTarget.dataset.index)
        const eleve = this.elevesValue[index]
        delete this.results[eleve.id]
        this.renderTable()
    }

    async resetAll() {
        if (!await showConfirm('Réinitialiser tous les résultats ?', { title: 'Réinitialisation', confirmLabel: 'Réinitialiser' })) return
        if (this.running) {
            clearInterval(this.interval)
            this.running = false
        }
        this.results = {}
        this.selectedIndex = null
        if (this._chart) { this._chart.destroy(); this._chart = null }
        this._setTimer('00:00.0')
        this._syncButtons(false)
        this.currentStudentTarget.textContent = 'Sélectionnez un élève ci-dessous'
        if (this.tabletOverlayTarget.style.display !== 'none') {
            this.tabletOverlayTarget.style.display = 'none'
            document.body.style.overflow = ''
        }
        this.renderTable()
    }

    async saveResults() {
        const label = await showSaveDialog()
        if (label === null) return

        const vmaTargetPct = this.getVmaTargetPct()
        const plotDistance = this.getPlotDistance()
        const resultats = this.elevesValue
            .filter(e => this.results[e.id]?.passages?.length > 0)
            .map(e => {
                const passages = this.results[e.id].passages
                const avgKmh = passages.reduce((s, p) => s + p.kmh, 0) / passages.length
                const vmaKmh = this.vmaStore[e.id] || null
                const vmaPercent = vmaKmh ? (avgKmh / vmaKmh) * 100 : null
                return {
                    eleveId: e.id, fullName: e.fullName, sexe: e.sexe,
                    nbPassages: passages.length,
                    vmaKmh, avgKmh: Math.round(avgKmh * 10) / 10,
                    vmaPercent: vmaPercent ? Math.round(vmaPercent * 10) / 10 : null,
                    contrat: vmaPercent !== null ? avgKmh >= vmaKmh * (vmaTargetPct / 100) : null,
                }
            })

        if (resultats.length === 0) {
            await showAlert('Aucun résultat à sauvegarder.', { type: 'info', title: 'Résultats vides' })
            return
        }

        await this._postSave('vitesse', label, {
            config: { plotDistance, vmaTargetPct },
            resultats,
        })
    }

    async _postSave(outil, label, data) {
        const btn = this.saveBtnTarget
        btn.disabled = true
        try {
            const res = await fetch('/api/resultats', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outil, classeId: this.classeIdValue, label, data }),
            })
            if (!res.ok) throw new Error()
            btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Sauvegardé !'
            btn.classList.replace('btn-success', 'btn-outline-success')
            setTimeout(() => {
                btn.innerHTML = '<i class="bi bi-cloud-upload-fill me-1"></i>Sauvegarder'
                btn.classList.replace('btn-outline-success', 'btn-success')
                btn.disabled = false
            }, 2500)
        } catch {
            btn.innerHTML = '<i class="bi bi-x-lg me-1"></i>Erreur'
            btn.classList.replace('btn-success', 'btn-outline-danger')
            setTimeout(() => {
                btn.innerHTML = '<i class="bi bi-cloud-upload-fill me-1"></i>Sauvegarder'
                btn.classList.replace('btn-outline-danger', 'btn-success')
                btn.disabled = false
            }, 2500)
        }
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60)
        const secs = seconds % 60
        return `${String(mins).padStart(2, '0')}:${secs.toFixed(1).padStart(4, '0')}`
    }
}
