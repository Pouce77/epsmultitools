import { Controller } from '@hotwired/stimulus'
import { showAlert } from '../utils/dialog.js'

export default class extends Controller {
    static targets = ['nbEquipesInput', 'mixiteInput', 'niveauInput', 'equipesDisplay', 'infoText', 'infoContent', 'swapHint', 'eleveSelectList', 'selectCounter']
    static values = { eleves: Array }

    connect() {
        this.teams = []
        this.selected = null // { teamIndex, eleveIndex }
        this.excludedIds = new Set()
        this._renderSelectPanel()
    }

    // ── Student selection panel ────────────────────────────────────────────

    _renderSelectPanel() {
        if (!this.hasEleveSelectListTarget) return
        const list = this.eleveSelectListTarget
        list.innerHTML = ''

        this.elevesValue.forEach(eleve => {
            const excluded = this.excludedIds.has(eleve.id)
            const chip = document.createElement('span')
            chip.className = `badge rounded-pill border me-1 mb-1 user-select-none`
            chip.style.cursor = 'pointer'
            chip.style.fontSize = '.8rem'
            chip.style.transition = 'opacity .15s'

            if (excluded) {
                chip.style.opacity = '0.35'
                chip.style.background = '#e9ecef'
                chip.style.color = '#6c757d'
                chip.style.borderColor = '#dee2e6'
                chip.title = 'Exlu — cliquer pour réintégrer'
            } else {
                chip.style.opacity = '1'
                chip.style.background = '#e6f7f5'
                chip.style.color = '#0a7468'
                chip.style.borderColor = '#0f9e8e'
                chip.title = 'Cliquer pour exclure'
            }

            let label = this.escapeHtml(eleve.fullName)
            if (eleve.sexe) label = `${eleve.sexe === 'M' ? '♂' : '♀'} ` + label
            if (eleve.niveau) label += ` <span style="opacity:.7">${eleve.niveau}</span>`
            chip.innerHTML = label

            chip.addEventListener('click', () => {
                if (this.excludedIds.has(eleve.id)) {
                    this.excludedIds.delete(eleve.id)
                } else {
                    this.excludedIds.add(eleve.id)
                }
                this._renderSelectPanel()
            })
            list.appendChild(chip)
        })

        this._updateSelectCounter()
    }

    _updateSelectCounter() {
        if (!this.hasSelectCounterTarget) return
        const total  = this.elevesValue.length
        const active = total - this.excludedIds.size
        this.selectCounterTarget.textContent = `${active} / ${total} élève(s) sélectionné(s)`
    }

    selectAll() {
        this.excludedIds.clear()
        this._renderSelectPanel()
    }

    selectNone() {
        this.elevesValue.forEach(e => this.excludedIds.add(e.id))
        this._renderSelectPanel()
    }

    _activeEleves() {
        return this.elevesValue.filter(e => !this.excludedIds.has(e.id))
    }

    generate() {
        const nb = Math.max(2, Math.min(10, parseInt(this.nbEquipesInputTarget.value) || 2))
        const respectMixite = this.mixiteInputTarget.checked
        const respectNiveau = this.niveauInputTarget.checked
        const actifs = this._activeEleves()
        if (actifs.length < 2) {
            showAlert('Sélectionnez au moins 2 élèves avant de générer les équipes.', { title: 'Sélection insuffisante', type: 'warning' })
            return
        }
        this.teams = this.buildTeams(actifs, nb, respectMixite, respectNiveau)
        this.selected = null
        this.render()
    }

    shuffle() {
        if (this.teams.length === 0) {
            this.generate()
            return
        }
        const nb = this.teams.length
        const respectMixite = this.mixiteInputTarget.checked
        const respectNiveau = this.niveauInputTarget.checked
        const actifs = this._activeEleves()
        if (actifs.length < 2) return
        this.teams = this.buildTeams(actifs, nb, respectMixite, respectNiveau)
        this.selected = null
        this.render()
    }

    buildTeams(eleves, nb, respectMixite, respectNiveau) {
        const teams = Array.from({ length: nb }, () => [])

        if (respectMixite && respectNiveau) {
            // Snake draft within each sex group separately → niveau balanced + mixité
            const filles  = eleves.filter(e => e.sexe === 'F')
            const garcons = eleves.filter(e => e.sexe === 'M')
            const autres  = eleves.filter(e => !e.sexe)
            this._snakeDraft(filles,  teams)
            this._snakeDraft(garcons, teams)
            this._snakeDraft(autres,  teams)
        } else if (respectNiveau) {
            // Snake draft on all students sorted by niveau
            this._snakeDraft([...eleves], teams)
        } else if (respectMixite) {
            // Round-robin after shuffle within each sex group
            const garcons = eleves.filter(e => e.sexe === 'M')
            const filles  = eleves.filter(e => e.sexe === 'F')
            const autres  = eleves.filter(e => !e.sexe)
            this.fisherYates(garcons)
            this.fisherYates(filles)
            this.fisherYates(autres)
            ;[...filles, ...garcons, ...autres].forEach((eleve, i) => {
                teams[i % nb].push(eleve)
            })
        } else {
            const all = [...eleves]
            this.fisherYates(all)
            all.forEach((eleve, i) => {
                teams[i % nb].push(eleve)
            })
        }

        return teams
    }

    // Snake draft: sort by niveau desc (nulls last), then distribute in snake order
    // Pick order for 3 teams: 0,1,2, 2,1,0, 0,1,2, ...
    _snakeDraft(eleves, teams) {
        const sorted = this._sortByNiveau(eleves)
        const nb = teams.length
        sorted.forEach((eleve, i) => {
            const row = Math.floor(i / nb)
            const posInRow = i % nb
            const teamIdx = row % 2 === 0 ? posInRow : (nb - 1 - posInRow)
            teams[teamIdx].push(eleve)
        })
    }

    // Sort descending by niveau, shuffle within same niveau level, nulls last
    _sortByNiveau(eleves) {
        const groups = {}
        eleves.forEach(e => {
            const n = e.niveau ?? 0
            if (!groups[n]) groups[n] = []
            groups[n].push(e)
        })
        Object.values(groups).forEach(g => this.fisherYates(g))
        return Object.keys(groups)
            .map(Number)
            .sort((a, b) => b - a)       // descending, 0 (null) → last
            .flatMap(k => groups[k])
    }

    fisherYates(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]]
        }
    }

    // ── Rendering ─────────────────────────────────────────────────────────

    render() {
        const container = this.equipesDisplayTarget
        container.innerHTML = ''

        if (this.teams.length === 0) return

        // Info bar
        const actifs     = this._activeEleves()
        const garcons    = actifs.filter(e => e.sexe === 'M').length
        const filles     = actifs.filter(e => e.sexe === 'F').length
        const avecNiveau = actifs.filter(e => e.niveau).length
        let infoStr = `${actifs.length} élève(s) répartis`
        if (garcons > 0 || filles > 0) {
            infoStr += ` — ${garcons} garçon(s), ${filles} fille(s)`
            const autres = this.elevesValue.length - garcons - filles
            if (autres > 0) infoStr += `, ${autres} non renseigné(s)`
        }
        if (avecNiveau > 0) {
            infoStr += ` — ${avecNiveau} avec niveau renseigné`
        }
        this.infoContentTarget.textContent = infoStr
        this.infoTextTarget.style.display = ''

        const colors   = ['primary', 'danger', 'success', 'warning', 'info', 'dark', 'secondary', 'teal']
        const colClass = this.teams.length <= 2 ? 'col-md-6' :
                         this.teams.length <= 4 ? 'col-md-6 col-lg-3' :
                         this.teams.length <= 6 ? 'col-md-4' : 'col-md-3'

        this.teams.forEach((team, ti) => {
            const color = colors[ti % colors.length]
            const col   = document.createElement('div')
            col.className = colClass

            const garconCount = team.filter(e => e.sexe === 'M').length
            const filleCount  = team.filter(e => e.sexe === 'F').length
            const niveaux     = team.filter(e => e.niveau).map(e => e.niveau)
            const avgNiveau   = niveaux.length > 0
                ? (niveaux.reduce((s, n) => s + n, 0) / niveaux.length).toFixed(1)
                : null

            // Card shell
            col.innerHTML = `
                <div class="card border-0 shadow-sm h-100" style="border-top: 4px solid var(--bs-${color}) !important;">
                    <div class="card-header bg-white border-0 py-2 px-3 d-flex align-items-center justify-content-between">
                        <input type="text" class="form-control form-control-sm border-0 fw-bold text-${color} ps-0"
                               value="Équipe ${ti + 1}" style="background:transparent;max-width:120px">
                        <small class="text-muted">${team.length} élèves
                            ${garconCount > 0 ? `<span class="text-info ms-1">♂${garconCount}</span>` : ''}
                            ${filleCount  > 0 ? `<span class="text-danger ms-1">♀${filleCount}</span>` : ''}
                            ${avgNiveau !== null ? `<span class="ms-1 text-secondary">moy.${avgNiveau}</span>` : ''}
                        </small>
                    </div>
                    <div class="card-body p-2">
                        <div class="d-flex flex-column gap-1 js-chip-list"></div>
                    </div>
                </div>
            `

            // Build chips with direct event listeners (avoids data-action on dynamic content)
            const chipList = col.querySelector('.js-chip-list')
            team.forEach((eleve, ei) => {
                const isSelected = this.selected?.teamIndex === ti && this.selected?.eleveIndex === ei
                const chip = document.createElement('div')
                chip.className = `eleve-chip d-flex align-items-center gap-1 p-1 rounded ${isSelected ? 'bg-warning bg-opacity-25 border border-warning' : 'bg-light'}`
                chip.style.cursor = 'pointer'
                chip.innerHTML = `
                    ${eleve.sexe === 'M' ? '<span class="text-info" style="font-size:.8rem">♂</span>' :
                      eleve.sexe === 'F' ? '<span class="text-danger" style="font-size:.8rem">♀</span>' :
                      '<span style="font-size:.8rem"> </span>'}
                    <span class="small fw-semibold flex-grow-1">${this.escapeHtml(eleve.fullName)}</span>
                    ${eleve.niveau ? `<span class="badge rounded-pill ${this._niveauBadgeClass(eleve.niveau)}" style="font-size:.65rem" title="Niveau ${eleve.niveau}">${eleve.niveau}</span>` : ''}
                `
                chip.addEventListener('click', () => this._handleChipClick(ti, ei))
                chipList.appendChild(chip)
            })

            container.appendChild(col)
        })

        if (this.swapHintTarget) {
            this.swapHintTarget.style.display = ''
        }
    }

    _niveauBadgeClass(n) {
        const classes = { 1: 'bg-danger', 2: 'bg-warning text-dark', 3: 'bg-info text-dark', 4: 'bg-primary', 5: 'bg-success' }
        return classes[n] ?? 'bg-secondary'
    }

    // ── Swap ──────────────────────────────────────────────────────────────

    _handleChipClick(ti, ei) {
        if (this.selected === null) {
            this.selected = { teamIndex: ti, eleveIndex: ei }
            this.render()
        } else {
            const from = this.selected
            if (from.teamIndex === ti && from.eleveIndex === ei) {
                // Deselect
                this.selected = null
                this.render()
                return
            }
            // Swap
            const temp = this.teams[from.teamIndex][from.eleveIndex]
            this.teams[from.teamIndex][from.eleveIndex] = this.teams[ti][ei]
            this.teams[ti][ei] = temp
            this.selected = null
            this.render()
        }
    }

    // ── Print ─────────────────────────────────────────────────────────────

    async print() {
        if (this.teams.length === 0) {
            await showAlert('Générez des équipes d\'abord.', { title: 'Équipes requises', type: 'info' })
            return
        }
        const niveauLabels = { 1: 'Faible', 2: 'Moyen −', 3: 'Moyen', 4: 'Moyen +', 5: 'Fort' }
        let content = '<html><head><title>Équipes</title>'
        content += '<style>body{font-family:Arial,sans-serif;padding:20px} h2{margin-top:20px} ul{margin:0;padding-left:20px}</style>'
        content += '</head><body>'
        content += `<h1>Équipes — ${document.title}</h1>`
        this.teams.forEach((team, ti) => {
            content += `<h2>Équipe ${ti + 1} (${team.length} élèves)</h2><ul>`
            team.forEach(e => {
                content += `<li>${this.escapeHtml(e.fullName)}`
                if (e.sexe) content += ` (${e.sexe})`
                if (e.niveau) content += ` — Niveau ${e.niveau} (${niveauLabels[e.niveau]})`
                content += '</li>'
            })
            content += '</ul>'
        })
        content += '</body></html>'
        const win = window.open('', '_blank')
        win.document.write(content)
        win.document.close()
        win.print()
    }

    escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }
}
