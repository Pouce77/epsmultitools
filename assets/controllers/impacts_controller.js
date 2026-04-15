import { Controller } from '@hotwired/stimulus'
import { showSaveDialog, showAlert } from '../utils/dialog.js'

export default class extends Controller {
    static targets = [
        'courtContainer', 'observeSelect', 'observateurSelect',
        'statsList', 'modeToggle', 'sportBtn',
        // tablet mode
        'normalView', 'tabletOverlay',
        'tabletCourtContainer', 'tabletObserveSelect', 'tabletObservateurSelect',
        'tabletStatsList', 'tabletCounter', 'tabletModeToggle', 'tabletSportBtn',
    ]
    static values = { eleves: Array, classe: String, classeId: Number }

    COLORS = ['#e84020', '#0f9e8e', '#f5b800', '#6f42c1', '#fd7e14', '#20c997', '#0d6efd', '#e91e63', '#795548', '#607d8b']

    connect() {
        this.impacts      = []
        this.currentSport = 'badminton'
        this.deleteMode   = false
        this.tabletMode   = false
        this._eleveColors = {}
        this._renderCourt()
        this._updateStats()
    }

    // ── Tablet mode ───────────────────────────────────────────────────────

    enterTabletMode() {
        // Sync selects avant de basculer
        this.tabletObserveSelectTarget.value     = this.observeSelectTarget.value
        this.tabletObservateurSelectTarget.value = this.observateurSelectTarget.value
        // Basculer le mode AVANT de rendre le terrain
        this.tabletMode = true
        this.normalViewTarget.style.display = 'none'
        this.tabletOverlayTarget.style.display = 'flex'
        document.body.style.overflow = 'hidden'
        this._renderCourt()
        this._updateStats()
    }

    exitTabletMode() {
        // Sync back AVANT de basculer
        this.observeSelectTarget.value     = this.tabletObserveSelectTarget.value
        this.observateurSelectTarget.value = this.tabletObservateurSelectTarget.value
        if (this.deleteMode) this.toggleDeleteMode()
        // Basculer le mode AVANT de rendre le terrain
        this.tabletMode = false
        this.tabletOverlayTarget.style.display = 'none'
        this.normalViewTarget.style.display = ''
        document.body.style.overflow = ''
        this._renderCourt()
        this._updateStats()
    }

    tabletSelectEleve() {
        this.observeSelectTarget.value = this.tabletObserveSelectTarget.value
        this._updateStats()
    }

    tabletSelectObservateur() {
        this.observateurSelectTarget.value = this.tabletObservateurSelectTarget.value
    }

    // ── Sport selection ───────────────────────────────────────────────────

    setSport(event) {
        this.currentSport = event.currentTarget.dataset.sport
        this.sportBtnTargets.forEach(b => {
            const active = b.dataset.sport === this.currentSport
            b.classList.toggle('btn-primary', active)
            b.classList.toggle('btn-outline-secondary', !active)
        })
        this._renderCourt()
        this._updateStats()
    }

    // ── Delete mode ───────────────────────────────────────────────────────

    toggleDeleteMode() {
        this.deleteMode = !this.deleteMode
        // Update all modeToggle targets (normal + tablet)
        this.modeToggleTargets.forEach(btn => {
            btn.classList.toggle('btn-danger', this.deleteMode)
            btn.classList.toggle('btn-outline-danger', !this.deleteMode)
            btn.innerHTML = this.deleteMode
                ? '<i class="bi bi-eraser-fill"></i>'
                : '<i class="bi bi-eraser"></i>'
        })
        const svg = this._activeCourt()
        if (svg) {
            svg.style.cursor = this.deleteMode ? 'default' : 'crosshair'
            svg.classList.toggle('delete-mode', this.deleteMode)
        }
    }

    // ── Undo last ─────────────────────────────────────────────────────────

    undoLast() {
        const sportImpacts = this.impacts.filter(i => i.sport === this.currentSport)
        if (!sportImpacts.length) return
        const last = sportImpacts[sportImpacts.length - 1]
        this.impacts = this.impacts.filter(i => i.id !== last.id)
        this._renderCourt()
        this._updateStats()
    }

    // ── Active court helper ───────────────────────────────────────────────

    _activeCourt() {
        const container = this.tabletMode ? this.tabletCourtContainerTarget : this.courtContainerTarget
        return container.querySelector('svg.court-svg')
    }

    _activeContainer() {
        return this.tabletMode ? this.tabletCourtContainerTarget : this.courtContainerTarget
    }

    // ── Click on court ────────────────────────────────────────────────────

    handleCourtClick(event) {
        if (this.deleteMode) return

        const eleveId = parseInt(this.observeSelectTarget.value)
        if (!eleveId) {
            const sel = this.tabletMode ? this.tabletObserveSelectTarget : this.observeSelectTarget
            sel.style.outline = '2px solid #e84020'
            sel.style.borderColor = '#e84020'
            setTimeout(() => { sel.style.outline = ''; sel.style.borderColor = '' }, 1200)
            return
        }

        const svg = this._activeCourt()
        if (!svg) return

        const rect = svg.getBoundingClientRect()
        const vb   = svg.viewBox.baseVal
        const x = ((event.clientX - rect.left)  / rect.width)  * vb.width
        const y = ((event.clientY - rect.top)    / rect.height) * vb.height

        const eleve       = this.elevesValue.find(e => e.id === eleveId)
        const observateur = parseInt(this.observateurSelectTarget.value) || null
        const color       = this._getColor(eleveId)
        const seq         = this.impacts.filter(i => i.eleveId === eleveId && i.sport === this.currentSport).length + 1

        const impact = { id: Date.now() + Math.random(), x, y, eleveId, eleveName: eleve?.fullName ?? '?', observateur, color, sport: this.currentSport, seq }
        this.impacts.push(impact)
        this._drawDot(impact)
        this._updateStats()
    }

    _getColor(eleveId) {
        if (!this._eleveColors[eleveId]) {
            const used = Object.keys(this._eleveColors).length
            this._eleveColors[eleveId] = this.COLORS[used % this.COLORS.length]
        }
        return this._eleveColors[eleveId]
    }

    // ── Render court ──────────────────────────────────────────────────────

    _renderCourt() {
        const container = this._activeContainer()
        container.innerHTML = this._buildCourtSvg(this.currentSport)
        const svg = container.querySelector('svg.court-svg')
        svg.style.cursor = this.deleteMode ? 'default' : 'crosshair'
        svg.addEventListener('click', e => {
            if (e.target.closest('.impact-dot')) return
            this.handleCourtClick(e)
        })
        this.impacts
            .filter(i => i.sport === this.currentSport)
            .forEach(i => this._drawDot(i))
    }

    _buildCourtSvg(sport) {
        if (sport === 'tennis')   return this._tennisSvg()
        if (sport === 'pingpong') return this._pingpongSvg()
        return this._badmintonSvg()
    }

    // Badminton : 6.1 m × 13.4 m — viewBox "0 0 122 254"
    // Échelle : 1 unité ≈ 5.54 cm  (zone de jeu 110 × 242 unités)
    _badmintonSvg() {
        return `<svg class="court-svg" xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 122 254"
            style="width:100%;max-width:300px;display:block;margin:auto;cursor:crosshair;border-radius:6px;">
          <rect width="122" height="254" fill="#1b5e20" rx="6"/>
          <rect x="6" y="6" width="110" height="242" fill="#2e7d32"/>
          <!-- Limite extérieure (doubles) -->
          <rect x="6" y="6" width="110" height="242" fill="none" stroke="white" stroke-width="1.5"/>
          <!-- Lignes latérales simples (0.46 m = 8 u de chaque côté) -->
          <line x1="14" y1="6"   x2="14"  y2="248" stroke="white" stroke-width="0.8"/>
          <line x1="108" y1="6"  x2="108" y2="248" stroke="white" stroke-width="0.8"/>
          <!-- Lignes de service long doubles (0.76 m = 14 u depuis le fond) -->
          <line x1="6" y1="20"   x2="116" y2="20"  stroke="white" stroke-width="0.8"/>
          <line x1="6" y1="234"  x2="116" y2="234" stroke="white" stroke-width="0.8"/>
          <!-- Filet (centre) -->
          <line x1="6" y1="127"  x2="116" y2="127" stroke="white" stroke-width="2.5"/>
          <circle cx="6"   cy="127" r="1.5" fill="white"/>
          <circle cx="116" cy="127" r="1.5" fill="white"/>
          <!-- Lignes de service court (1.98 m = 36 u du filet) -->
          <line x1="6"  y1="91"  x2="116" y2="91"  stroke="white" stroke-width="0.8"/>
          <line x1="6"  y1="163" x2="116" y2="163" stroke="white" stroke-width="0.8"/>
          <!-- Ligne médiane (dans chaque camp) -->
          <line x1="61" y1="6"   x2="61"  y2="91"  stroke="white" stroke-width="0.8"/>
          <line x1="61" y1="163" x2="61"  y2="248" stroke="white" stroke-width="0.8"/>
          <!-- Libellé filet -->
          <text x="61" y="113" text-anchor="middle" font-size="4.5" fill="rgba(255,255,255,.4)" font-family="sans-serif">FILET</text>
        </svg>`
    }

    // Tennis doubles : 10.97 m × 23.77 m — viewBox "0 0 122 250"
    // Échelle : 1 unité ≈ 9.97 cm  (zone 110 × 238 unités)
    _tennisSvg() {
        return `<svg class="court-svg" xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 122 250"
            style="width:100%;max-width:300px;display:block;margin:auto;cursor:crosshair;border-radius:6px;">
          <rect width="122" height="250" fill="#0d47a1" rx="6"/>
          <rect x="6" y="6" width="110" height="238" fill="#1565c0"/>
          <!-- Limite extérieure (doubles) -->
          <rect x="6" y="6" width="110" height="238" fill="none" stroke="white" stroke-width="1.5"/>
          <!-- Lignes latérales simples (1.37 m = 14 u) -->
          <line x1="20" y1="6"   x2="20"  y2="244" stroke="white" stroke-width="0.8"/>
          <line x1="102" y1="6"  x2="102" y2="244" stroke="white" stroke-width="0.8"/>
          <!-- Filet (centre) -->
          <line x1="6"  y1="125" x2="116" y2="125" stroke="white" stroke-width="2.5"/>
          <circle cx="6"   cy="125" r="1.5" fill="white"/>
          <circle cx="116" cy="125" r="1.5" fill="white"/>
          <!-- Lignes de service (6.40 m = 64 u du filet) -->
          <line x1="20" y1="61"  x2="102" y2="61"  stroke="white" stroke-width="0.8"/>
          <line x1="20" y1="189" x2="102" y2="189" stroke="white" stroke-width="0.8"/>
          <!-- Ligne médiane de service -->
          <line x1="61" y1="61"  x2="61"  y2="189" stroke="white" stroke-width="0.8"/>
          <!-- Libellé filet -->
          <text x="61" y="112" text-anchor="middle" font-size="4.5" fill="rgba(255,255,255,.4)" font-family="sans-serif">FILET</text>
        </svg>`
    }

    // Tennis de table : 2.74 m × 1.525 m — viewBox "0 0 122 210"
    // Échelle : 1 unité ≈ 1.39 cm  (table 110 × 197 unités)
    _pingpongSvg() {
        return `<svg class="court-svg" xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 122 210"
            style="width:100%;max-width:300px;display:block;margin:auto;cursor:crosshair;border-radius:6px;">
          <rect width="122" height="210" fill="#0d3c61" rx="6"/>
          <!-- Table -->
          <rect x="6" y="6" width="110" height="198" fill="#1565c0" stroke="white" stroke-width="2" rx="2"/>
          <!-- Ligne blanche du bord (intérieure épaisse) -->
          <rect x="6" y="6" width="110" height="198" fill="none" stroke="white" stroke-width="2"/>
          <!-- Filet -->
          <rect x="4"   y="103" width="3" height="4" fill="white" rx="0.5"/>
          <rect x="115" y="103" width="3" height="4" fill="white" rx="0.5"/>
          <line x1="6" y1="105" x2="116" y2="105" stroke="white" stroke-width="2.5"/>
          <!-- Ligne médiane (pointillés) -->
          <line x1="61" y1="6" x2="61" y2="204" stroke="white" stroke-width="0.8" stroke-dasharray="4,3"/>
          <!-- Libellé filet -->
          <text x="61" y="99" text-anchor="middle" font-size="4.5" fill="rgba(255,255,255,.4)" font-family="sans-serif">FILET</text>
        </svg>`
    }

    // ── Draw / remove dots ────────────────────────────────────────────────

    _drawDot(impact) {
        const svg = this._activeCourt()
        if (!svg) return

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
        g.classList.add('impact-dot')
        g.setAttribute('data-impact-id', impact.id)

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
        circle.setAttribute('cx', impact.x)
        circle.setAttribute('cy', impact.y)
        circle.setAttribute('r', '4')
        circle.setAttribute('fill', impact.color)
        circle.setAttribute('fill-opacity', '0.85')
        circle.setAttribute('stroke', 'white')
        circle.setAttribute('stroke-width', '1')

        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title')
        title.textContent = `${impact.eleveName} #${impact.seq}`

        g.appendChild(circle)
        g.appendChild(title)

        g.addEventListener('click', e => {
            e.stopPropagation()
            if (!this.deleteMode) return
            this.impacts = this.impacts.filter(i => i.id !== impact.id)
            g.remove()
            this._updateStats()
        })

        svg.appendChild(g)
    }

    // ── Clear ─────────────────────────────────────────────────────────────

    clearAll() {
        this.impacts = this.impacts.filter(i => i.sport !== this.currentSport)
        this._renderCourt()
        this._updateStats()
    }

    clearEleve() {
        const eleveId = parseInt(this.observeSelectTarget.value)
        if (!eleveId) return
        this.impacts = this.impacts.filter(i => !(i.eleveId === eleveId && i.sport === this.currentSport))
        this._renderCourt()
        this._updateStats()
    }

    clearTabletEleve() {
        const eleveId = parseInt(this.tabletObserveSelectTarget.value)
        if (!eleveId) return
        this.observeSelectTarget.value = eleveId
        this.clearEleve()
    }

    refreshStats() { this._updateStats() }

    _updateTabletCounter() {
        if (!this.hasTabletCounterTarget) return
        const selected = parseInt(this.observeSelectTarget.value) || null
        const count = this.impacts.filter(i =>
            i.sport === this.currentSport && (!selected || i.eleveId === selected)
        ).length
        const label = selected
            ? (this.elevesValue.find(e => e.id === selected)?.fullName ?? '?')
            : 'tous'
        this.tabletCounterTarget.textContent = `${count} impact(s) — ${label}`
    }

    // ── Zone classification ───────────────────────────────────────────────

    _getZone(impact) {
        const specs = {
            badminton: { netY: 127, halfH: 121 },
            tennis:    { netY: 125, halfH: 119 },
            pingpong:  { netY: 105, halfH:  99 },
        }
        const s     = specs[impact.sport] ?? specs.badminton
        const dist  = Math.abs(impact.y - s.netY)
        const third = s.halfH / 3
        if (dist <= third)     return 'filet'
        if (dist <= third * 2) return 'milieu'
        return 'fond'
    }

    // ── Stats ─────────────────────────────────────────────────────────────

    _updateStats() {
        this._updateTabletCounter()
        const list = this.tabletMode ? this.tabletStatsListTarget : this.statsListTarget
        list.innerHTML = ''

        const sportImpacts = this.impacts.filter(i => i.sport === this.currentSport)
        const dark = this.tabletMode
        const mutedColor   = dark ? 'rgba(255,255,255,.45)' : ''
        const textColor    = dark ? 'white' : ''
        const trackBg      = dark ? 'rgba(255,255,255,.12)' : '#e9ecef'

        if (sportImpacts.length === 0) {
            list.innerHTML = `<p style="color:${mutedColor || '#6c757d'};font-size:.8rem;margin:0;">Aucun impact enregistré.</p>`
            return
        }

        const total = sportImpacts.length

        // Par élève
        const groups = {}
        sportImpacts.forEach(i => {
            if (!groups[i.eleveId]) groups[i.eleveId] = { name: i.eleveName, color: i.color, count: 0 }
            groups[i.eleveId].count++
        })

        const byEleve = document.createElement('div')
        byEleve.style.marginBottom = '12px'
        byEleve.innerHTML = `<div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:${mutedColor || '#6c757d'};margin-bottom:6px;">Par élève (${total})</div>`
        Object.values(groups)
            .sort((a, b) => b.count - a.count)
            .forEach(g => {
                byEleve.innerHTML += `
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                        <span style="flex-shrink:0;width:10px;height:10px;border-radius:50%;background:${g.color};display:inline-block;border:1px solid rgba(0,0,0,.15)"></span>
                        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;color:${textColor || 'inherit'}">${this.escapeHtml(g.name)}</span>
                        <span style="background:${g.color};color:white;border-radius:20px;padding:1px 7px;font-size:.72rem;font-weight:600;">${g.count}</span>
                    </div>`
            })
        list.appendChild(byEleve)

        // Par zone
        const ZONES = [
            { key: 'filet',  label: 'Filet',         color: '#e84020' },
            { key: 'milieu', label: 'Milieu',         color: '#f5b800' },
            { key: 'fond',   label: 'Fond de court',  color: '#0f9e8e' },
        ]
        const zoneCounts = { filet: 0, milieu: 0, fond: 0 }
        sportImpacts.forEach(i => { zoneCounts[this._getZone(i)]++ })

        const selectedId = parseInt(this.observeSelectTarget.value) || null
        let zoneForEleve = null
        if (selectedId) {
            zoneForEleve = { filet: 0, milieu: 0, fond: 0 }
            sportImpacts.filter(i => i.eleveId === selectedId).forEach(i => { zoneForEleve[this._getZone(i)]++ })
        }

        const byZone = document.createElement('div')
        byZone.innerHTML = `<div style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:${mutedColor || '#6c757d'};margin-bottom:6px;">Zones${selectedId ? ' (élève sél.)' : ''}</div>`

        ZONES.forEach(z => {
            const n    = selectedId ? zoneForEleve[z.key] : zoneCounts[z.key]
            const tot2 = selectedId ? sportImpacts.filter(i => i.eleveId === selectedId).length : total
            const pct  = tot2 > 0 ? Math.round((n / tot2) * 100) : 0
            byZone.innerHTML += `
                <div style="margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;">
                        <span style="font-size:.78rem;font-weight:600;color:${z.color}">${z.label}</span>
                        <span style="font-size:.75rem;color:${mutedColor || '#6c757d'}">${n} (${pct}%)</span>
                    </div>
                    <div style="height:7px;background:${trackBg};border-radius:4px;overflow:hidden;">
                        <div style="height:100%;width:${pct}%;background:${z.color};border-radius:4px;transition:width .3s;"></div>
                    </div>
                </div>`
        })
        list.appendChild(byZone)
    }

    // ── Load saved ────────────────────────────────────────────────────────

    async loadSaved() {
        // Fetch list
        let list
        try {
            const res = await fetch(`/api/resultats?outil=impacts&classeId=${this.classeIdValue}`, { credentials: 'same-origin' })
            if (!res.ok) throw new Error()
            list = await res.json()
        } catch {
            await showAlert('Impossible de récupérer les sauvegardes.', { type: 'error', title: 'Erreur' })
            return
        }

        if (!list.length) {
            await showAlert('Aucune sauvegarde d\'impacts pour cette classe.', { type: 'info', title: 'Aucune sauvegarde' })
            return
        }

        // Build modal
        const modalId = 'impacts-load-modal'
        let modal = document.getElementById(modalId)
        if (modal) modal.remove()

        modal = document.createElement('div')
        modal.id = modalId
        modal.className = 'modal fade'
        modal.tabIndex = -1
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-scrollable">
                <div class="modal-content border-0 shadow-lg">
                    <div class="modal-header border-0 text-white" style="background:linear-gradient(135deg,#1a2b3a,#0f9e8e);">
                        <h5 class="modal-title fw-bold"><i class="bi bi-folder2-open me-2"></i>Charger une sauvegarde</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-2">
                        <div class="list-group list-group-flush" id="${modalId}-list">
                            ${list.map(s => `
                                <button type="button"
                                        class="list-group-item list-group-item-action px-3 py-2"
                                        data-save-id="${s.id}">
                                    <div class="d-flex align-items-center gap-2">
                                        <i class="bi bi-clock text-muted" style="flex-shrink:0;"></i>
                                        <div class="flex-grow-1">
                                            <div class="fw-semibold small">${s.label ? this.escapeHtml(s.label) : '<span class="text-muted fst-italic">sans label</span>'}</div>
                                            <div class="text-muted" style="font-size:.75rem;">${s.createdAt}</div>
                                        </div>
                                        <i class="bi bi-chevron-right text-muted small"></i>
                                    </div>
                                </button>`).join('')}
                        </div>
                    </div>
                    <div class="modal-footer border-0 pt-0">
                        <small class="text-muted me-auto">Cliquez pour charger sur le terrain actuel</small>
                        <button type="button" class="btn btn-outline-secondary btn-sm" data-bs-dismiss="modal">Fermer</button>
                    </div>
                </div>
            </div>`

        document.body.appendChild(modal)

        // Click on a save
        modal.querySelector(`#${modalId}-list`).addEventListener('click', async e => {
            const btn = e.target.closest('[data-save-id]')
            if (!btn) return
            const id = btn.dataset.saveId

            btn.disabled = true
            btn.innerHTML = `<div class="d-flex align-items-center gap-2 px-3 py-1"><div class="spinner-border spinner-border-sm text-primary"></div><span class="small">Chargement…</span></div>`

            try {
                const res = await fetch(`/api/resultats/${id}`, { credentials: 'same-origin' })
                if (!res.ok) throw new Error()
                const { data } = await res.json()
                bootstrap.Modal.getInstance(modal).hide()
                this._restoreFromSave(data)
            } catch {
                btn.disabled = false
                await showAlert('Impossible de charger cette sauvegarde.', { type: 'error', title: 'Erreur' })
            }
        })

        new bootstrap.Modal(modal).show()
    }

    _restoreFromSave(data) {
        // Switch sport
        const sport = data.sport ?? 'badminton'
        this.currentSport = sport
        this.sportBtnTargets.forEach(b => {
            const active = b.dataset.sport === sport
            b.classList.toggle('btn-primary', active)
            b.classList.toggle('btn-outline-secondary', !active)
        })

        // Restore impacts (keep existing from other sports)
        this.impacts = this.impacts.filter(i => i.sport !== sport)

        const restored = (data.impacts ?? []).map(i => ({
            id:          Date.now() + Math.random(),
            x:           i.x,
            y:           i.y,
            seq:         i.seq,
            eleveId:     i.eleveId,
            eleveName:   i.eleveName,
            color:       i.color,
            sport:       sport,
            observateur: null,
        }))

        // Rebuild color map from restored data
        restored.forEach(i => { this._eleveColors[i.eleveId] = i.color })

        this.impacts.push(...restored)

        // Sync observe select if single eleve
        if (data.eleve?.id) {
            const opt = this.observeSelectTarget.querySelector(`option[value="${data.eleve.id}"]`)
            if (opt) {
                this.observeSelectTarget.value = data.eleve.id
                if (this.tabletMode) this.tabletObserveSelectTarget.value = data.eleve.id
            }
        }

        this._renderCourt()
        this._updateStats()

        showAlert(
            `${restored.length} impact(s) chargé(s)${data.eleve ? ' pour ' + this.escapeHtml(data.eleve.name) : ''}.`,
            { type: 'success', title: 'Sauvegarde chargée' }
        )
    }

    // ── Save ──────────────────────────────────────────────────────────────

    async save() {
        const sportImpacts = this.impacts.filter(i => i.sport === this.currentSport)
        if (sportImpacts.length === 0) {
            await showAlert('Aucun impact à sauvegarder sur ce terrain.', { type: 'info', title: 'Rien à sauvegarder' })
            return
        }

        const label = await showSaveDialog()
        if (label === null) return  // annulé

        const eleveId = parseInt(this.observeSelectTarget.value) || null
        const eleve   = eleveId ? this.elevesValue.find(e => e.id === eleveId) : null

        const payload = {
            outil:   'impacts',
            classeId: this.classeIdValue,
            label:   label || null,
            data: {
                sport:    this.currentSport,
                savedAt:  new Date().toISOString(),
                eleve:    eleve ? { id: eleve.id, name: eleve.fullName } : null,
                impacts:  sportImpacts.map(i => ({
                    x:    Math.round(i.x * 100) / 100,
                    y:    Math.round(i.y * 100) / 100,
                    seq:  i.seq,
                    zone: this._getZone(i),
                    eleveName:  i.eleveName,
                    eleveId:    i.eleveId,
                    color:      i.color,
                })),
            },
        }

        try {
            const res = await fetch('/api/resultats', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify(payload),
            })
            if (!res.ok) throw new Error()
            await showAlert('Impacts sauvegardés avec succès.', { type: 'success', title: 'Sauvegarde réussie' })
        } catch {
            await showAlert('Une erreur est survenue lors de la sauvegarde.', { type: 'error', title: 'Erreur' })
        }
    }

    // ── Print ─────────────────────────────────────────────────────────────

    print() {
        const eleveId = parseInt(this.observeSelectTarget.value)
        const sportImpacts = this.impacts.filter(i => i.sport === this.currentSport && (!eleveId || i.eleveId === eleveId))

        if (sportImpacts.length === 0) {
            alert('Aucun impact à imprimer pour la sélection en cours.')
            return
        }

        // Build a standalone SVG with only the filtered dots
        const courtSvg = this.courtContainerTarget.querySelector('svg.court-svg')
        if (!courtSvg) return

        // Clone the court SVG (lines only, no existing dots)
        const clone = courtSvg.cloneNode(true)
        clone.querySelectorAll('.impact-dot').forEach(n => n.remove())
        clone.removeAttribute('style')
        clone.style.width  = '220px'
        clone.style.height = 'auto'
        clone.style.display = 'block'
        clone.style.flexShrink = '0'

        // Draw dots grouped by student (if no student selected, draw all with their color)
        sportImpacts.forEach(impact => {
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')

            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            circle.setAttribute('cx', impact.x)
            circle.setAttribute('cy', impact.y)
            circle.setAttribute('r', '4')
            circle.setAttribute('fill', impact.color)
            circle.setAttribute('fill-opacity', '0.85')
            circle.setAttribute('stroke', 'white')
            circle.setAttribute('stroke-width', '1')

            // Sequence number label
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
            label.setAttribute('x', impact.x)
            label.setAttribute('y', impact.y + 1.5)
            label.setAttribute('text-anchor', 'middle')
            label.setAttribute('dominant-baseline', 'middle')
            label.setAttribute('font-size', '3.5')
            label.setAttribute('font-family', 'sans-serif')
            label.setAttribute('fill', 'white')
            label.setAttribute('font-weight', 'bold')
            label.textContent = impact.seq

            g.appendChild(circle)
            g.appendChild(label)
            clone.appendChild(g)
        })

        const svgStr = new XMLSerializer().serializeToString(clone)

        // Stats table per student
        const groups = {}
        sportImpacts.forEach(i => {
            if (!groups[i.eleveId]) groups[i.eleveId] = { name: i.eleveName, color: i.color, count: 0 }
            groups[i.eleveId].count++
        })

        const sportLabels = { badminton: 'Badminton', tennis: 'Tennis', pingpong: 'Tennis de table' }
        const sportLabel  = sportLabels[this.currentSport] ?? this.currentSport
        const eleve       = eleveId ? this.elevesValue.find(e => e.id === eleveId) : null
        const titre       = eleve ? `Impacts de ${this.escapeHtml(eleve.fullName)}` : 'Impacts — tous les élèves'
        const dateStr     = new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        const classeNom   = this.escapeHtml(this.classeValue)

        const statsRows = Object.values(groups).sort((a, b) => b.count - a.count).map(g =>
            `<tr>
                <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${g.color};margin-right:6px;vertical-align:middle"></span>${this.escapeHtml(g.name)}</td>
                <td style="text-align:center;font-weight:bold">${g.count}</td>
             </tr>`
        ).join('')

        // Zone stats
        const ZONES = [
            { key: 'filet',  label: 'Filet',        color: '#e84020' },
            { key: 'milieu', label: 'Milieu',        color: '#f5b800' },
            { key: 'fond',   label: 'Fond de court', color: '#0f9e8e' },
        ]
        const zoneCounts = { filet: 0, milieu: 0, fond: 0 }
        sportImpacts.forEach(i => { zoneCounts[this._getZone(i)]++ })
        const total = sportImpacts.length

        const zoneRows = ZONES.map(z => {
            const n   = zoneCounts[z.key]
            const pct = total > 0 ? Math.round((n / total) * 100) : 0
            return `<tr>
                <td>
                    <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${z.color};margin-right:6px;vertical-align:middle"></span>
                    ${z.label}
                </td>
                <td style="text-align:center;font-weight:bold">${n}</td>
                <td style="text-align:center;">
                    <div style="background:#eee;border-radius:4px;height:6px;width:80px;display:inline-block;vertical-align:middle;overflow:hidden;">
                        <div style="background:${z.color};height:100%;width:${pct}%;"></div>
                    </div>
                    <span style="margin-left:4px;font-size:9px;color:#666;">${pct}%</span>
                </td>
            </tr>`
        }).join('')

        const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${titre}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 12mm 14mm; color: #1a2b3a; font-size: 11px; }
    h1   { font-size: 14px; margin: 0 0 2px; }
    .sub { color: #666; font-size: 10px; margin-bottom: 10px; }
    .wrap { display: flex; gap: 18px; align-items: flex-start; }
    .stats { flex: 1 1 0; }
    table  { border-collapse: collapse; width: 100%; margin-top: 6px; }
    th, td { border: 1px solid #ddd; padding: 4px 7px; font-size: 10px; }
    th     { background: #f2f7f6; }
    h3     { font-size: 11px; margin: 12px 0 2px; color: #0a7468; }
    @media print {
      body  { margin: 8mm 10mm; }
      @page { size: A4 portrait; margin: 0; }
    }
  </style>
</head>
<body>
  <h1>${titre}</h1>
  <p class="sub">Classe : <strong>${classeNom}</strong> · Terrain : ${sportLabel} · ${sportImpacts.length} impact(s) · ${dateStr}</p>
  <div class="wrap">
    <div class="court">${svgStr}</div>
    <div class="stats">
      <h3>Par élève</h3>
      <table>
        <thead><tr><th>Élève</th><th>Impacts</th></tr></thead>
        <tbody>${statsRows}</tbody>
      </table>
      <h3>Répartition par zone</h3>
      <table>
        <thead><tr><th>Zone</th><th>Impacts</th><th>%</th></tr></thead>
        <tbody>${zoneRows}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`

        const win = window.open('', '_blank')
        win.document.write(html)
        win.document.close()
        win.addEventListener('load', () => win.print())
    }

    escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }
}
