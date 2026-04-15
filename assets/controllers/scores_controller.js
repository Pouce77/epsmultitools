import { Controller } from '@hotwired/stimulus'
import { showConfirm, showSaveDialog } from '../utils/dialog.js'

const SPORTS = {
    generic:    { label: 'Générique',       icon: '🏆', type: 'team'       },
    football:   { label: 'Football',        icon: '⚽', type: 'team'       },
    rugby:      { label: 'Rugby',           icon: '🏉', type: 'team'       },
    basketball: { label: 'Basket-ball',     icon: '🏀', type: 'team'       },
    handball:   { label: 'Handball',        icon: '🤾', type: 'team'       },
    volleyball: { label: 'Volley-ball',      icon: '🏐', type: 'team'       },
    badminton:  { label: 'Badminton',        icon: '🏸', type: 'individual' },
    pingpong:   { label: 'Tennis de table',  icon: '🏓', type: 'individual' },
    tennis:     { label: 'Tennis',           icon: '🎾', type: 'individual' },
    boxe:       { label: 'Boxe',             icon: '🥊', type: 'individual' },
    lutte:      { label: 'Lutte',            icon: '🤼', type: 'individual' },
}

const COLORS = ['primary', 'danger', 'success', 'warning', 'info', 'dark']
const SIDE_COLORS  = ['primary', 'danger']
const SIDE_LABELS  = ['Côté A', 'Côté B']

export default class extends Controller {
    static targets = [
        'sportBtn',
        'setupSection', 'configBar', 'assignmentPanel',
        'gameSection', 'scoreDisplay', 'foulsPanel',
        'matchTimer', 'timerStartBtn', 'timerStopBtn', 'saveBtn',
    ]
    static values = { eleves: Array, classeId: Number }

    // ── Lifecycle ──────────────────────────────────────────────────────

    connect() {
        this.timerRunning  = false
        this.timerStart    = null
        this.timerElapsed  = 0
        this.timerInterval = null
        this.phase = 'setup'
        this.sport = 'generic'
        this._initState()
        this.renderAll()
    }

    disconnect() { clearInterval(this.timerInterval) }

    _initState() {
        this.teams = [
            { nom: 'Équipe A', score: 0, color: 'primary' },
            { nom: 'Équipe B', score: 0, color: 'danger'  },
        ]
        this.service         = 0
        this.fouls           = {}
        this.assignments     = {}       // team sports: eleveId → teamIndex
        this.selectedPlayers = [[null, null], [null, null]]  // individual: [side][slot] = name|null
        this.isDouble        = false
        this.tennis          = { points: [0, 0], games: [0, 0], sets: [] }
        this.volleyball      = { sets: [] }
        this.boxe            = { round: 1, roundScores: [], ko: -1 }
        this.lutte           = { tombe: -1 }
        this._nbTeams        = 2
        this._step           = 1
    }

    _isIndividual()  { return SPORTS[this.sport]?.type === 'individual' }
    _hasDouble()     { return this._isIndividual() && !['boxe', 'lutte'].includes(this.sport) }

    // ── Phase transitions ──────────────────────────────────────────────

    _showSetup() {
        this.setupSectionTarget.style.display = 'block'
        this.gameSectionTarget.style.display  = 'none'
    }

    _showGame() {
        this.setupSectionTarget.style.display = 'none'
        this.gameSectionTarget.style.display  = 'block'
    }

    launchGame() {
        if (this._isIndividual()) {
            // Build team names from selected players
            const slots = this.isDouble ? [0, 1] : [0]
            ;[0, 1].forEach(side => {
                const names = slots.map(s => this.selectedPlayers[side][s]).filter(Boolean)
                if (names.length > 0) this.teams[side].nom = names.join(' / ')
            })
        }
        this.phase = 'game'
        this._showGame()
        this._renderScores()
    }

    // ── Sport selection ────────────────────────────────────────────────

    selectSport(event) {
        const sport = event.currentTarget.dataset.sport
        if (sport === this.sport) return
        this.sport = sport
        this.sportBtnTargets.forEach(btn => {
            const active = btn.dataset.sport === sport
            btn.classList.toggle('btn-primary',           active)
            btn.classList.toggle('btn-outline-secondary', !active)
        })
        this.phase = 'setup'
        this._initState()
        this._showSetup()
        this.renderAll()
    }

    // ── Render entry point ─────────────────────────────────────────────

    renderAll() {
        this._renderConfigBar()
        this._renderAssignmentPanel()
        if (this.phase === 'game') this._renderScores()
    }

    // ── Config bar ─────────────────────────────────────────────────────

    _renderConfigBar() {
        const hints = {
            football:   'Football / Futsal — +1 but par équipe.',
            rugby:      'Rugby — Essai (+5) · Transformation (+2) · Pénalité / Drop (+3).',
            basketball: 'Basket-ball — +1 / +2 / +3. Fautes individuelles suivies en dessous.',
            handball:   'Handball — +1 but par équipe.',
            volleyball: 'Volley-ball — Sets en 25 pts (écart de 2), set décisif en 15 pts. Best of 3.',
            badminton:  'Badminton — Max 21 pts, écart de 2. Serveur change à chaque point marqué.',
            pingpong:   'Tennis de table — Max 11 pts, écart de 2. Service change toutes les 2 balles.',
            tennis:     'Tennis — Jeux → Sets (best of 3). Déuce & avantage automatiques.',
            boxe:       'Boxe — Points par touche. Avancer les rounds manuellement. KO = victoire immédiate.',
            lutte:      'Lutte — Dégagement +1 · Renversement +2 · Grand amplitude +3 · Tombé = victoire immédiate.',
        }
        if (this.sport === 'generic') {
            this.configBarTarget.innerHTML = `
                <div class="d-flex gap-3 align-items-end flex-wrap">
                    <div>
                        <label class="form-label fw-semibold mb-1 small">Équipes</label>
                        <input type="number" id="nb-teams-input" class="form-control form-control-sm"
                               style="width:70px" value="${this._nbTeams}" min="2" max="8">
                    </div>
                    <div>
                        <label class="form-label fw-semibold mb-1 small">Points / action</label>
                        <input type="number" id="step-input" class="form-control form-control-sm"
                               style="width:70px" value="${this._step}" min="1">
                    </div>
                    <button class="btn btn-primary btn-sm" data-action="scores#setupTeams">
                        <i class="bi bi-gear me-1"></i>Appliquer
                    </button>
                </div>
                <div class="mb-2"></div>`
        } else {
            this.configBarTarget.innerHTML =
                `<p class="text-muted small mb-0"><i class="bi bi-info-circle me-1"></i>${hints[this.sport] ?? ''}</p>`
        }
    }

    // ── Player assignment panel ────────────────────────────────────────

    _renderAssignmentPanel() {
        if (this.elevesValue.length === 0 && !this._isIndividual()) {
            this.assignmentPanelTarget.innerHTML = ''
            return
        }
        if (this._isIndividual()) {
            this._renderAssignmentIndividual()
        } else {
            this._renderAssignmentTeams()
        }
    }

    // Individual sports: select 1 or 2 players per side
    _renderAssignmentIndividual() {
        const slots      = this.isDouble ? [0, 1] : [0]
        const slotLabels = ['Joueur 1', 'Joueur 2']

        const sideRows = [0, 1].map(side => {
            const inputs = slots.map(slot => {
                const current = this.selectedPlayers[side][slot]
                if (this.elevesValue.length > 0) {
                    // Filter out players already selected on the other side
                    const otherSide = 1 - side
                    const takenByOther = this.selectedPlayers[otherSide].filter(Boolean)
                    const options = this.elevesValue
                        .filter(e => !takenByOther.includes(e.fullName) || e.fullName === current)
                        .map(e => `<option value="${this.escapeHtml(e.fullName)}"
                                           ${current === e.fullName ? 'selected' : ''}>
                                       ${this.escapeHtml(e.fullName)}
                                   </option>`).join('')
                    return `
                        <select class="form-select form-select-sm"
                                style="max-width:220px;"
                                data-action="scores#selectIndividualPlayer"
                                data-side="${side}" data-slot="${slot}">
                            <option value="">— ${slotLabels[slot]} —</option>
                            ${options}
                        </select>`
                } else {
                    return `
                        <input type="text"
                               class="form-control form-control-sm"
                               style="max-width:220px;"
                               placeholder="${slotLabels[slot]}"
                               value="${this.escapeHtml(current ?? '')}"
                               data-action="input->scores#inputIndividualName"
                               data-side="${side}" data-slot="${slot}">`
                }
            }).join('')

            return `
                <div class="d-flex align-items-center gap-2 mb-2 flex-wrap">
                    <span class="badge bg-${SIDE_COLORS[side]}"
                          style="min-width:72px;font-size:.82rem;padding:.35em .6em;">
                        ${SIDE_LABELS[side]}
                    </span>
                    ${inputs}
                </div>`
        }).join('')

        this.assignmentPanelTarget.innerHTML = `
            <div class="card border-0 shadow-sm mb-3">
                <div class="card-body p-3">
                    <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
                        <h6 class="fw-semibold mb-0">
                            <i class="bi bi-person-fill me-2"></i>Sélection des joueurs
                        </h6>
                        ${this._hasDouble() ? `
                        <div class="btn-group btn-group-sm ms-auto" role="group">
                            <button type="button"
                                    class="btn ${!this.isDouble ? 'btn-primary' : 'btn-outline-secondary'}"
                                    data-action="scores#setSimple">Simple</button>
                            <button type="button"
                                    class="btn ${this.isDouble ? 'btn-primary' : 'btn-outline-secondary'}"
                                    data-action="scores#setDouble">Double</button>
                        </div>` : ''}
                    </div>
                    ${sideRows}
                </div>
            </div>`
    }

    selectIndividualPlayer(event) {
        const side = parseInt(event.currentTarget.dataset.side)
        const slot = parseInt(event.currentTarget.dataset.slot)
        this.selectedPlayers[side][slot] = event.currentTarget.value || null
        this._renderAssignmentPanel()
    }

    inputIndividualName(event) {
        const side = parseInt(event.currentTarget.dataset.side)
        const slot = parseInt(event.currentTarget.dataset.slot)
        this.selectedPlayers[side][slot] = event.currentTarget.value || null
    }

    setSimple() { this.isDouble = false; this._renderAssignmentPanel() }
    setDouble() { this.isDouble = true;  this._renderAssignmentPanel() }

    // Team sports: pool-based assignment
    _renderAssignmentTeams() {
        const unassigned = this.elevesValue.filter(e => this.assignments[e.id] === undefined)

        const teamRows = this.teams.map((team, i) => {
            const members = this.elevesValue.filter(e => this.assignments[e.id] === i)
            const chips   = members.map(e => `
                <span class="badge rounded-pill d-inline-flex align-items-center gap-1
                             border border-${team.color} text-${team.color} bg-white"
                      style="font-size:.78rem;font-weight:500;">
                    ${this.escapeHtml(e.fullName)}
                    <button type="button" class="btn-close"
                            style="font-size:.45rem;filter:none;opacity:.7;"
                            data-action="scores#unassignPlayer"
                            data-eleve="${e.id}"
                            aria-label="Retirer"></button>
                </span>`).join('')
            return `
                <div class="d-flex align-items-start gap-2 mb-2 flex-wrap">
                    <span class="badge bg-${team.color} flex-shrink-0"
                          style="min-width:88px;font-size:.78rem;padding:.35em .6em;">
                        ${this.escapeHtml(team.nom)}
                    </span>
                    <div class="d-flex flex-wrap gap-1 flex-grow-1 align-items-center">
                        ${chips || '<span class="text-muted fst-italic" style="font-size:.78rem;">Aucun joueur</span>'}
                    </div>
                </div>`
        }).join('')

        const pool = unassigned.map(e => {
            const btns = this.teams.map((team, i) => `
                <button type="button"
                        class="btn btn-${team.color} py-0 px-2"
                        style="font-size:.72rem;"
                        data-action="scores#assignToTeam"
                        data-eleve="${e.id}" data-team="${i}">
                    ${this.escapeHtml(team.nom)}
                </button>`).join('')
            return `
                <div class="d-inline-flex align-items-center border rounded-pill overflow-hidden bg-white shadow-sm mb-1"
                     style="font-size:.82rem;">
                    <span class="px-2 py-1 bg-light border-end fw-semibold" style="white-space:nowrap;">
                        ${this.escapeHtml(e.fullName)}
                    </span>
                    <div class="d-flex">${btns}</div>
                </div>`
        }).join(' ')

        const poolSection = unassigned.length > 0 ? `
            <div class="border-top pt-3 mt-2">
                <div class="text-muted small mb-2">
                    <i class="bi bi-person-dash me-1"></i>Non assignés (${unassigned.length}) :
                </div>
                <div class="d-flex flex-wrap gap-1">${pool}</div>
            </div>` : `
            <div class="border-top pt-2 mt-1">
                <span class="text-success small"><i class="bi bi-check-circle me-1"></i>Tous les joueurs sont assignés.</span>
            </div>`

        this.assignmentPanelTarget.innerHTML = `
            <div class="card border-0 shadow-sm mb-3">
                <div class="card-body p-3">
                    <div class="d-flex align-items-center gap-2 mb-3">
                        <h6 class="fw-semibold mb-0">
                            <i class="bi bi-people-fill me-2"></i>Répartition des joueurs
                        </h6>
                        <button type="button"
                                class="btn btn-sm btn-outline-secondary ms-auto"
                                data-action="scores#randomAssign"
                                title="Répartition aléatoire">
                            <i class="bi bi-shuffle me-1"></i>Aléatoire
                        </button>
                    </div>
                    ${teamRows}
                    ${poolSection}
                </div>
            </div>`
    }

    assignToTeam(event) {
        const eleveId = parseInt(event.currentTarget.dataset.eleve)
        const teamIdx = parseInt(event.currentTarget.dataset.team)
        this.assignments[eleveId] = teamIdx
        this._renderAssignmentPanel()
    }

    unassignPlayer(event) {
        delete this.assignments[parseInt(event.currentTarget.dataset.eleve)]
        this._renderAssignmentPanel()
    }

    randomAssign() {
        const shuffled = [...this.elevesValue].sort(() => Math.random() - .5)
        this.assignments = {}
        shuffled.forEach((e, idx) => { this.assignments[e.id] = idx % this.teams.length })
        this._renderAssignmentPanel()
    }

    // ── Score rendering dispatcher ─────────────────────────────────────

    _renderScores() {
        if (this.sport === 'tennis') {
            this._renderTennis()
        } else if (this.sport === 'volleyball') {
            this._renderVolleyball()
        } else if (this.sport === 'boxe') {
            this._renderBoxe()
        } else {
            this._renderTeamCards()
        }
        if (this.sport === 'basketball' && this.elevesValue.length > 0) {
            this.foulsPanelTarget.style.display = 'block'
            this._renderFouls()
        } else {
            this.foulsPanelTarget.style.display = 'none'
        }
    }

    // ── Team cards ─────────────────────────────────────────────────────

    _renderTeamCards() {
        const n        = this.teams.length
        const colClass = n <= 2 ? 'col-md-6' : n <= 4 ? 'col-md-6 col-lg-3' : 'col-sm-6 col-lg-4'
        this.scoreDisplayTarget.innerHTML = ''
        this.teams.forEach((team, i) => {
            const members    = this.elevesValue.filter(e => this.assignments[e.id] === i)
            const membersHtml = members.length > 0 ? `
                <div class="d-flex flex-wrap gap-1 justify-content-center my-2">
                    ${members.map(e =>
                        `<span class="badge bg-light text-dark border px-2 py-1" style="font-size:.72rem;">${this.escapeHtml(e.fullName)}</span>`
                    ).join('')}
                </div>` : ''
            const col = document.createElement('div')
            col.className = colClass
            col.innerHTML = `
                <div class="card border-0 shadow h-100 text-center"
                     style="border-top:5px solid var(--bs-${team.color}) !important;">
                    <div class="card-body p-3 p-lg-4 d-flex flex-column">
                        ${this._serviceIndicator(i)}
                        <input type="text"
                               class="form-control text-center fw-bold border-0 bg-transparent mb-1 fs-5"
                               value="${this.escapeHtml(team.nom)}"
                               data-action="change->scores#renameTeam" data-team="${i}">
                        ${membersHtml}
                        <div class="fw-bold text-${team.color} mt-1 mb-2"
                             data-team-score="${i}"
                             style="font-size:clamp(3rem,8vw,5rem);line-height:1.1">${team.score}</div>
                        ${this._scoreButtons(i)}
                    </div>
                </div>`
            this.scoreDisplayTarget.appendChild(col)
        })
    }

    _serviceIndicator(i) {
        if (this.sport !== 'badminton' && this.sport !== 'pingpong') return ''
        const icon = this.sport === 'badminton' ? '🏸' : '🏓'
        return `<div style="height:26px" class="mb-1">
            ${this.service === i
                ? `<span class="badge rounded-pill fw-semibold" style="background:#0f9e8e;color:#fff;font-size:.75rem;">${icon} Service</span>`
                : ''}</div>`
    }

    _scoreButtons(i) {
        const c = this.teams[i].color
        switch (this.sport) {
            case 'generic':
                return `<div class="d-flex gap-2 justify-content-center mt-auto pt-2">
                    <button class="btn btn-outline-${c} btn-lg px-3 fw-bold"
                            data-action="scores#decrement" data-team="${i}">−</button>
                    <button class="btn btn-${c} btn-lg px-3 fw-bold"
                            data-action="scores#increment" data-team="${i}">+</button>
                </div>`
            case 'football':
            case 'handball':
                return `<div class="d-flex gap-2 justify-content-center mt-auto pt-2">
                    <button class="btn btn-outline-${c} btn-lg px-3"
                            data-action="scores#decrement" data-team="${i}">−1</button>
                    <button class="btn btn-${c} btn-lg px-4 fw-bold"
                            data-action="scores#simpleIncrement" data-team="${i}">+1 But</button>
                </div>`
            case 'rugby':
                return `<div class="d-flex flex-wrap gap-1 justify-content-center mt-auto pt-2">
                    <button class="btn btn-outline-${c} btn-sm px-2"
                            data-action="scores#decrement" data-team="${i}">−</button>
                    <button class="btn btn-${c} btn-sm px-2"
                            data-action="scores#addPts" data-team="${i}" data-pts="5">Essai +5</button>
                    <button class="btn btn-${c} btn-sm px-2"
                            data-action="scores#addPts" data-team="${i}" data-pts="2">Transf. +2</button>
                    <button class="btn btn-${c} btn-sm px-2"
                            data-action="scores#addPts" data-team="${i}" data-pts="3">Pénal. +3</button>
                </div>`
            case 'basketball':
                return `<div class="d-flex flex-wrap gap-1 justify-content-center mt-auto pt-2">
                    <button class="btn btn-outline-${c} btn-sm px-2"
                            data-action="scores#decrement" data-team="${i}">−1</button>
                    <button class="btn btn-${c} btn-sm px-3"
                            data-action="scores#addPts" data-team="${i}" data-pts="1">+1</button>
                    <button class="btn btn-${c} btn-sm px-3"
                            data-action="scores#addPts" data-team="${i}" data-pts="2">+2</button>
                    <button class="btn btn-${c} btn-sm px-3"
                            data-action="scores#addPts" data-team="${i}" data-pts="3">+3</button>
                </div>`
            case 'badminton':
            case 'pingpong': {
                const max = this.sport === 'badminton' ? 21 : 11
                const s   = this.teams[i].score
                const opp = this.teams[1 - i]?.score ?? 0
                const won = s >= max && s - opp >= 2
                return `<div class="d-flex gap-2 justify-content-center mt-auto pt-2">
                    <button class="btn btn-outline-${c} btn-lg px-3"
                            data-action="scores#decrement" data-team="${i}">−</button>
                    <button class="btn btn-${c} btn-lg px-4 fw-bold"
                            data-action="scores#serviceIncrement" data-team="${i}">+1</button>
                </div>
                ${won ? `<div class="mt-2"><span class="badge text-white px-3 py-1" style="background:#0f9e8e;">🏆 Jeu !</span></div>` : ''}`
            }
            case 'lutte': {
                const knocked = this.lutte.tombe === i
                const disabled = this.lutte.tombe !== -1 ? 'disabled' : ''
                return `
                <div class="d-flex flex-wrap gap-1 justify-content-center mt-auto pt-2">
                    <button class="btn btn-outline-${c} btn-sm px-2" ${disabled}
                            data-action="scores#decrement" data-team="${i}">−</button>
                    <button class="btn btn-${c} btn-sm px-2" ${disabled}
                            data-action="scores#addPts" data-team="${i}" data-pts="1">Dégag. +1</button>
                    <button class="btn btn-${c} btn-sm px-2" ${disabled}
                            data-action="scores#addPts" data-team="${i}" data-pts="2">Revers. +2</button>
                    <button class="btn btn-${c} btn-sm px-2" ${disabled}
                            data-action="scores#addPts" data-team="${i}" data-pts="3">Amplitu. +3</button>
                </div>
                <div class="mt-2">
                    ${knocked
                        ? `<span class="badge fs-6 px-3 py-2" style="background:#0f9e8e;color:#fff;">🏆 Victoire par tombé !</span>`
                        : `<button class="btn btn-danger btn-sm px-3"
                                   data-action="scores#declareTombe" data-team="${i}">
                               🏁 Tombé
                           </button>`}
                </div>`
            }
            default: return ''
        }
    }

    // ── Tennis ─────────────────────────────────────────────────────────

    _renderTennis() {
        const PTS = ['0', '15', '30', '40', 'Avt']
        const t   = this.tennis
        const sA  = t.sets.filter(s => s[0] > s[1]).length
        const sB  = t.sets.filter(s => s[1] > s[0]).length
        const won = sA >= 2 ? 0 : sB >= 2 ? 1 : -1

        const rows = [0, 1].map(p => `
            <tr>
                <td class="text-start p-1">
                    <input type="text"
                           class="form-control form-control-sm border-0 bg-transparent fw-bold"
                           value="${this.escapeHtml(this.teams[p].nom)}"
                           data-action="change->scores#renameTeam" data-team="${p}">
                </td>
                ${t.sets.map(s =>
                    `<td class="fw-bold ${s[p] > s[1-p] ? 'text-success' : 'text-muted'}">${s[p]}</td>`
                ).join('')}
                <td class="fw-bold">${t.games[p]}</td>
                <td class="fw-bold fs-5 ${t.points[p] === 4 ? 'text-warning' : ''}">
                    ${PTS[t.points[p]]}
                </td>
            </tr>`).join('')

        this.scoreDisplayTarget.innerHTML = `
            <div class="col-12">
                <div class="card border-0 shadow">
                    <div class="card-body p-3">
                        <div class="table-responsive mb-3">
                            <table class="table table-bordered mb-0 text-center align-middle"
                                   style="font-size:1.05rem;">
                                <thead class="table-light">
                                    <tr>
                                        <th class="text-start" style="min-width:150px">Joueur</th>
                                        ${t.sets.map((_, j) => `<th>Set ${j + 1}</th>`).join('')}
                                        <th>Jeux</th>
                                        <th style="min-width:70px">Points</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                        <div class="d-flex gap-3 justify-content-center flex-wrap">
                            ${[0, 1].map(p => `
                                <button class="btn btn-${this.teams[p].color} btn-lg px-5"
                                        data-action="scores#tennisPoint" data-team="${p}"
                                        ${won !== -1 ? 'disabled' : ''}>
                                    Point <strong>${this.escapeHtml(this.teams[p].nom)}</strong>
                                </button>`).join('')}
                        </div>
                        ${won !== -1 ? `
                            <div class="text-center mt-3">
                                <span class="badge fs-5 px-4 py-2" style="background:#0f9e8e;color:#fff;">
                                    🏆 ${this.escapeHtml(this.teams[won].nom)} remporte le match !
                                </span>
                            </div>` : ''}
                    </div>
                </div>
            </div>`
    }

    tennisPoint(event) {
        const p   = parseInt(event.currentTarget.dataset.team)
        const opp = 1 - p
        const t   = this.tennis
        if (t.points[p] === 3 && t.points[opp] === 3) {
            t.points[p] = 4
        } else if (t.points[p] === 4) {
            this._tennisGameWon(p)
        } else if (t.points[opp] === 4) {
            t.points[opp] = 3
        } else {
            t.points[p]++
            if (t.points[p] >= 4) this._tennisGameWon(p)
        }
        this._renderTennis()
    }

    _tennisGameWon(p) {
        const t = this.tennis
        t.points = [0, 0]
        t.games[p]++
        const [my, opp] = [t.games[p], t.games[1 - p]]
        if ((my >= 6 && my - opp >= 2) || my === 7) {
            t.sets.push([...t.games])
            t.games = [0, 0]
        }
    }

    // ── Volleyball ─────────────────────────────────────────────────────

    _renderVolleyball() {
        const v   = this.volleyball
        const won = v.sets.filter(s => s[0] > s[1]).length >= 2 ? 0
                  : v.sets.filter(s => s[1] > s[0]).length >= 2 ? 1 : -1
        const setNum  = v.sets.length + 1
        const target  = setNum >= 3 ? 15 : 25

        const rows = [0, 1].map(p => `
            <tr>
                <td class="text-start p-1">
                    <input type="text"
                           class="form-control form-control-sm border-0 bg-transparent fw-bold"
                           value="${this.escapeHtml(this.teams[p].nom)}"
                           data-action="change->scores#renameTeam" data-team="${p}">
                </td>
                ${v.sets.map(s =>
                    `<td class="fw-bold ${s[p] > s[1-p] ? 'text-success' : 'text-muted'}">${s[p]}</td>`
                ).join('')}
                <td class="fw-bold fs-5 text-${this.teams[p].color}">${this.teams[p].score}</td>
            </tr>`).join('')

        this.scoreDisplayTarget.innerHTML = `
            <div class="col-12">
                <div class="card border-0 shadow">
                    <div class="card-body p-3">
                        <div class="table-responsive mb-3">
                            <table class="table table-bordered mb-0 text-center align-middle"
                                   style="font-size:1.05rem;">
                                <thead class="table-light">
                                    <tr>
                                        <th class="text-start" style="min-width:150px">Équipe</th>
                                        ${v.sets.map((_, j) => `<th>Set ${j + 1}</th>`).join('')}
                                        <th>Set ${setNum} <small class="text-muted fw-normal">/ ${target}</small></th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                        <div class="d-flex gap-3 justify-content-center flex-wrap">
                            ${[0, 1].map(p => `
                                <button class="btn btn-${this.teams[p].color} btn-lg px-5"
                                        data-action="scores#volleyballPoint" data-team="${p}"
                                        ${won !== -1 ? 'disabled' : ''}>
                                    Point <strong>${this.escapeHtml(this.teams[p].nom)}</strong>
                                </button>`).join('')}
                        </div>
                        ${won !== -1 ? `
                            <div class="text-center mt-3">
                                <span class="badge fs-5 px-4 py-2" style="background:#0f9e8e;color:#fff;">
                                    🏆 ${this.escapeHtml(this.teams[won].nom)} remporte le match !
                                </span>
                            </div>` : ''}
                    </div>
                </div>
            </div>`
    }

    volleyballPoint(event) {
        const p     = parseInt(event.currentTarget.dataset.team)
        const v     = this.volleyball
        const setNum = v.sets.length + 1
        const target = setNum >= 3 ? 15 : 25
        this.teams[p].score++
        const [a, b] = [this.teams[0].score, this.teams[1].score]
        if ((a >= target || b >= target) && Math.abs(a - b) >= 2) {
            v.sets.push([a, b])
            this.teams[0].score = 0
            this.teams[1].score = 0
        }
        this._renderVolleyball()
    }

    // ── Boxe ────────────────────────────────────────────────────────────

    _renderBoxe() {
        const bx      = this.boxe
        const maxRound = 3
        const totals   = [0, 1].map(p =>
            bx.roundScores.reduce((sum, r) => sum + r[p], 0) + this.teams[p].score
        )
        const rows = [0, 1].map(p => `
            <tr>
                <td class="text-start p-1">
                    <input type="text"
                           class="form-control form-control-sm border-0 bg-transparent fw-bold"
                           value="${this.escapeHtml(this.teams[p].nom)}"
                           data-action="change->scores#renameTeam" data-team="${p}">
                </td>
                ${bx.roundScores.map(r =>
                    `<td class="fw-bold ${r[p] > r[1-p] ? 'text-success' : r[p] < r[1-p] ? 'text-muted' : ''}">${r[p]}</td>`
                ).join('')}
                <td class="fw-bold text-${this.teams[p].color} fs-5">${this.teams[p].score}</td>
                <td class="fw-bold">${totals[p]}</td>
            </tr>`).join('')

        const finished     = bx.roundScores.length >= maxRound || bx.ko !== -1
        const matchWinner  = finished && bx.ko === -1
            ? (totals[0] > totals[1] ? 0 : totals[1] > totals[0] ? 1 : -1)
            : bx.ko

        this.scoreDisplayTarget.innerHTML = `
            <div class="col-12">
                <div class="card border-0 shadow">
                    <div class="card-body p-3">
                        <div class="table-responsive mb-3">
                            <table class="table table-bordered mb-0 text-center align-middle"
                                   style="font-size:1.05rem;">
                                <thead class="table-light">
                                    <tr>
                                        <th class="text-start" style="min-width:150px">Boxeur</th>
                                        ${bx.roundScores.map((_, j) => `<th>Round ${j + 1}</th>`).join('')}
                                        ${!finished ? `<th>Round ${bx.round} <small class="text-muted fw-normal">en cours</small></th>` : ''}
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>${rows}</tbody>
                            </table>
                        </div>
                        ${!finished ? `
                        <div class="d-flex gap-3 justify-content-center flex-wrap mb-3">
                            ${[0, 1].map(p => `
                                <div class="d-flex flex-column align-items-center gap-1">
                                    <span class="badge bg-${this.teams[p].color} mb-1">${this.escapeHtml(this.teams[p].nom)}</span>
                                    <div class="d-flex gap-1">
                                        <button class="btn btn-outline-${this.teams[p].color} btn-sm px-2"
                                                data-action="scores#decrement" data-team="${p}">−</button>
                                        <button class="btn btn-${this.teams[p].color} btn-sm px-3"
                                                data-action="scores#addPts" data-team="${p}" data-pts="1">+1</button>
                                        <button class="btn btn-${this.teams[p].color} btn-sm px-3"
                                                data-action="scores#addPts" data-team="${p}" data-pts="2">+2</button>
                                    </div>
                                </div>`).join('')}
                        </div>
                        <div class="d-flex gap-2 justify-content-center flex-wrap">
                            ${bx.round < maxRound ? `
                                <button class="btn btn-outline-secondary btn-sm px-3"
                                        data-action="scores#endRound">
                                    <i class="bi bi-skip-end-fill me-1"></i>Fin du round ${bx.round}
                                </button>` : ''}
                            ${[0, 1].map(p => `
                                <button class="btn btn-danger btn-sm px-3"
                                        data-action="scores#declareKO" data-team="${p}">
                                    🥊 KO — ${this.escapeHtml(this.teams[p].nom)}
                                </button>`).join('')}
                        </div>` : ''}
                        ${matchWinner !== -1 ? `
                            <div class="text-center mt-3">
                                <span class="badge fs-5 px-4 py-2" style="background:#0f9e8e;color:#fff;">
                                    🏆 ${this.escapeHtml(this.teams[matchWinner].nom)} remporte le match !
                                    ${bx.ko !== -1 ? ' (KO)' : ''}
                                </span>
                            </div>` : matchWinner === -1 && finished ? `
                            <div class="text-center mt-3">
                                <span class="badge fs-5 px-4 py-2 bg-secondary">Match nul</span>
                            </div>` : ''}
                    </div>
                </div>
            </div>`
    }

    endRound() {
        const bx = this.boxe
        bx.roundScores.push([this.teams[0].score, this.teams[1].score])
        this.teams[0].score = 0
        this.teams[1].score = 0
        bx.round++
        this._renderBoxe()
    }

    declareKO(event) {
        this.boxe.ko = parseInt(event.currentTarget.dataset.team)
        this._renderBoxe()
    }

    declareTombe(event) {
        this.lutte.tombe = parseInt(event.currentTarget.dataset.team)
        this._renderTeamCards()
    }

    // ── Basketball fouls ───────────────────────────────────────────────

    _renderFouls() {
        const teamCols = this.teams.map((team, i) => {
            const members = this.elevesValue.filter(e => this.assignments[e.id] === i)
            if (members.length === 0) return ''
            const rows = members.map(e => {
                const f    = this.fouls[e.id] || 0
                const disq = f >= 5
                return `
                    <div class="p-2 rounded-2 d-flex align-items-center gap-2 mb-1
                                ${disq ? 'bg-danger bg-opacity-10 border border-danger' : 'bg-light'}">
                        <div class="flex-grow-1 overflow-hidden">
                            <div class="fw-semibold small text-truncate ${disq ? 'text-danger' : ''}">
                                ${this.escapeHtml(e.fullName)}
                            </div>
                        </div>
                        <div class="d-flex align-items-center gap-1 flex-shrink-0">
                            <button class="btn btn-sm btn-outline-secondary py-0 px-1"
                                    data-action="scores#removeFoul" data-eleve="${e.id}">−</button>
                            <span class="fw-bold px-1 ${disq ? 'text-danger' : ''}"
                                  style="min-width:18px;text-align:center">${f}</span>
                            <button class="btn btn-sm ${disq ? 'btn-danger' : 'btn-outline-warning'} py-0 px-1"
                                    data-action="scores#addFoul" data-eleve="${e.id}">+</button>
                        </div>
                        ${disq ? '<span class="badge bg-danger flex-shrink-0" style="font-size:.62rem;">DISQ.</span>' : ''}
                    </div>`
            }).join('')

            return `
                <div class="col">
                    <div class="fw-semibold small mb-2">
                        <span class="badge bg-${team.color} me-1">${this.escapeHtml(team.nom)}</span>
                    </div>
                    ${rows}
                </div>`
        }).join('')

        this.foulsPanelTarget.innerHTML = `
            <div class="card border-0 shadow-sm mt-3">
                <div class="card-body p-3">
                    <h6 class="fw-semibold mb-3">
                        <i class="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                        Fautes individuelles
                        <small class="text-muted fw-normal ms-2">(5 = disqualification)</small>
                    </h6>
                    <div class="row g-3">${teamCols}</div>
                </div>
            </div>`
    }

    addFoul(event) {
        const id = parseInt(event.currentTarget.dataset.eleve)
        this.fouls[id] = Math.min(5, (this.fouls[id] || 0) + 1)
        this._renderFouls()
    }

    removeFoul(event) {
        const id = parseInt(event.currentTarget.dataset.eleve)
        this.fouls[id] = Math.max(0, (this.fouls[id] || 0) - 1)
        this._renderFouls()
    }

    // ── Score actions ──────────────────────────────────────────────────

    increment(event) {
        const i = parseInt(event.currentTarget.dataset.team)
        this.teams[i].score += this._step
        this._updateScoreEl(i)
    }

    simpleIncrement(event) {
        const i = parseInt(event.currentTarget.dataset.team)
        this.teams[i].score++
        this._updateScoreEl(i)
    }

    addPts(event) {
        const i   = parseInt(event.currentTarget.dataset.team)
        const pts = parseInt(event.currentTarget.dataset.pts)
        this.teams[i].score += pts
        if (this.sport === 'boxe') this._renderBoxe()
        else this._updateScoreEl(i)
    }

    decrement(event) {
        const i    = parseInt(event.currentTarget.dataset.team)
        const step = this.sport === 'generic' ? this._step : 1
        this.teams[i].score = Math.max(0, this.teams[i].score - step)
        if (this.sport === 'badminton' || this.sport === 'pingpong') this._renderTeamCards()
        else if (this.sport === 'boxe') this._renderBoxe()
        else this._updateScoreEl(i)
    }

    serviceIncrement(event) {
        const i = parseInt(event.currentTarget.dataset.team)
        this.teams[i].score++
        if (this.sport === 'badminton') {
            this.service = i
        } else {
            const [a, b] = [this.teams[0].score, this.teams[1].score]
            const total  = a + b
            this.service = (a >= 10 && b >= 10)
                ? (Math.floor(20 / 2) + (total - 20)) % 2
                : Math.floor(total / 2) % 2
        }
        this._renderTeamCards()
    }

    _updateScoreEl(i) {
        const el = this.scoreDisplayTarget.querySelector(`[data-team-score="${i}"]`)
        if (el) el.textContent = this.teams[i].score
    }

    renameTeam(event) {
        this.teams[parseInt(event.currentTarget.dataset.team)].nom = event.currentTarget.value
    }

    setupTeams() {
        const nbEl   = this.configBarTarget.querySelector('#nb-teams-input')
        const stepEl = this.configBarTarget.querySelector('#step-input')
        if (nbEl)   this._nbTeams = Math.max(2, Math.min(8, parseInt(nbEl.value)   || 2))
        if (stepEl) this._step    = Math.max(1,             parseInt(stepEl.value) || 1)
        this.teams = Array.from({ length: this._nbTeams }, (_, i) => ({
            nom: `Équipe ${i + 1}`, score: 0, color: COLORS[i % COLORS.length],
        }))
        this.assignments = {}
        this._renderAssignmentPanel()
    }

    // ── Reset ──────────────────────────────────────────────────────────

    async resetAll() {
        if (!await showConfirm('Remettre à zéro et revenir à la sélection ?', {
            title: 'Réinitialisation', confirmLabel: 'Réinitialiser',
        })) return
        this.phase = 'setup'
        this._initState()
        this._showSetup()
        this.renderAll()
    }

    // ── Save ───────────────────────────────────────────────────────────

    async saveResults() {
        const label = await showSaveDialog()
        if (label === null) return

        const data = {
            sport:     this.sport,
            resultats: this.teams.map(t => ({ team: t.nom, score: t.score })),
        }

        if (!this._isIndividual() && Object.keys(this.assignments).length > 0) {
            data.joueurs = {}
            this.teams.forEach((team, i) => {
                const members = this.elevesValue.filter(e => this.assignments[e.id] === i)
                if (members.length > 0) data.joueurs[team.nom] = members.map(e => e.fullName)
            })
        }
        if (this._isIndividual()) {
            data.format = this.isDouble ? 'double' : 'simple'
        }
        if (this.sport === 'basketball' && Object.keys(this.fouls).length > 0) {
            data.fouls = {}
            this.elevesValue.forEach(e => { if (this.fouls[e.id]) data.fouls[e.fullName] = this.fouls[e.id] })
        }
        if (this.sport === 'tennis') data.tennis = this.tennis

        const btn = this.saveBtnTarget
        btn.disabled = true
        try {
            const res = await fetch('/api/resultats', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outil: 'scores', classeId: this.classeIdValue, label: label || null, data }),
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

    // ── Timer ──────────────────────────────────────────────────────────

    startTimer() {
        if (this.timerRunning) return
        this.timerRunning = true
        this.timerStart   = performance.now() - this.timerElapsed * 1000
        this.timerStartBtnTarget.disabled = true
        this.timerStopBtnTarget.disabled  = false
        this.timerInterval = setInterval(() => {
            this.timerElapsed = (performance.now() - this.timerStart) / 1000
            this.matchTimerTarget.textContent = this._fmtTimer(this.timerElapsed)
        }, 500)
    }

    stopTimer() {
        clearInterval(this.timerInterval)
        this.timerRunning = false
        this.timerStartBtnTarget.disabled = false
        this.timerStopBtnTarget.disabled  = true
    }

    resetTimer() {
        this.stopTimer()
        this.timerElapsed = 0
        this.matchTimerTarget.textContent = '00:00'
    }

    _fmtTimer(s) {
        return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
    }

    escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }
}
