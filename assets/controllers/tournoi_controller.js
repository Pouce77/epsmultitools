import { Controller } from '@hotwired/stimulus'
import { showAlert, showSaveDialog } from '../utils/dialog.js'

export default class extends Controller {
    static targets = [
        'modeGroup', 'nbTerrainsInput', 'durationInput',
        'winPtsInput', 'drawPtsInput', 'lossPtsInput', 'defiConfig',
        'rankAdjustInput', 'rankAdjustConfig', 'rankBonusInput', 'rankMalusInput', 'rankMaxInput', 'rankMaxLossInput',
        'teamListLabel', 'autoTeamsLabel', 'addLabel',
        'teamList', 'bracketDisplay',
        'saveBtn', 'loadPanel', 'loadList',
    ]
    static values = { eleves: Array, classeId: Number }

    connect() {
        this.mode = 'roundrobin'
        this.teams = []
        this.scores = {}
        this.defiStats   = {}   // { name: { pts, j, g, n, p } }
        this.defiHistory = []   // [{ p1, p2, s1, s2 }]
        this.defiPrevRanks = {}
        this.consolationBracket = null
    }

    // ── Mode selector ──────────────────────────────────────────────────────

    setMode(event) {
        this.mode = event.currentTarget.dataset.mode
        this.modeGroupTarget.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('btn-primary',         btn.dataset.mode === this.mode)
            btn.classList.toggle('btn-outline-primary', btn.dataset.mode !== this.mode)
        })
        const isDefi = this.mode === 'defi'
        this.defiConfigTarget.style.display = isDefi ? '' : 'none'
        document.getElementById('nbTerrainsWrap').style.display = isDefi ? 'none' : ''
        document.getElementById('durationWrap').style.display   = isDefi ? 'none' : ''
        this.autoTeamsLabelTarget.textContent = 'Charger les élèves'
        this.addLabelTarget.textContent       = isDefi ? 'Ajouter un joueur'  : 'Ajouter une équipe'
        this.teamListLabelTarget.textContent  = isDefi ? 'Joueurs'            : 'Équipes / Participants'
    }

    // ── Team / player list ────────────────────────────────────────────────

    autoTeams() {
        // Charge les élèves individuellement, triés par niveau desc puis alphabétique
        const sorted = [...this.elevesValue].sort((a, b) => {
            if (a.niveau && b.niveau) return b.niveau - a.niveau
            if (a.niveau) return -1
            if (b.niveau) return 1
            return a.fullName.localeCompare(b.fullName)
        })
        this.teams = sorted.map(e => e.fullName)
        this.renderTeamList()
    }

    addTeam() {
        const label = this.mode === 'defi' ? `Joueur ${this.teams.length + 1}` : `Équipe ${this.teams.length + 1}`
        this.teams.push(label)
        this.renderTeamList()
    }

    renderTeamList() {
        const container = this.teamListTarget
        container.innerHTML = ''
        this.teams.forEach((team, i) => {
            const wrap = document.createElement('div')
            wrap.className = 'd-flex align-items-center gap-1 mb-1'
            wrap.innerHTML = `
                <input type="text" class="form-control form-control-sm" style="width:170px"
                       value="${this.escapeHtml(team)}"
                       data-action="input->tournoi#renameTeam" data-index="${i}">
                <button class="btn btn-sm btn-outline-danger py-0 px-1"
                        data-action="tournoi#removeTeam" data-index="${i}">✕</button>
            `
            container.appendChild(wrap)
        })
        if (this.teams.length === 0) {
            container.innerHTML = '<span class="text-muted small">Aucun participant. Cliquez sur "Charger les élèves" ou "Ajouter".</span>'
        }
    }

    renameTeam(event) {
        this.teams[parseInt(event.currentTarget.dataset.index)] = event.currentTarget.value
    }

    removeTeam(event) {
        this.teams.splice(parseInt(event.currentTarget.dataset.index), 1)
        this.renderTeamList()
    }

    // ── Generate ───────────────────────────────────────────────────────────

    async generate() {
        if (this.teams.length < 2) {
            await showAlert('Ajoutez au moins 2 participants.', { title: 'Participants insuffisants', type: 'info' })
            return
        }
        this.scores = {}
        this.defiStats = {}
        this.defiHistory = []
        this.defiPrevRanks = {}

        if (this.mode === 'roundrobin') {
            this.renderRoundRobin()
        } else if (this.mode === 'elimination') {
            this.renderElimination()
        } else {
            this.teams.forEach(name => {
                this.defiStats[name] = { pts: 0, j: 0, g: 0, n: 0, p: 0 }
            })
            this.renderDefi()
        }
    }

    // ── Round robin ────────────────────────────────────────────────────────

    renderRoundRobin() {
        const teams = [...this.teams]
        const nbTerrains = Math.max(1, parseInt(this.nbTerrainsInputTarget.value) || 1)
        const duration   = parseInt(this.durationInputTarget.value) || 5

        if (teams.length % 2 !== 0) teams.push('BYE')
        const rounds = this.generateRoundRobin(teams)

        let html = `
        <div class="card border-0 shadow-sm mb-3">
            <div class="card-header bg-white border-0 py-2 px-3">
                <strong>📋 Calendrier des rencontres</strong>
                <span class="text-muted ms-2 small">${teams.filter(t => t !== 'BYE').length} équipes — ${rounds.length} journée(s)</span>
            </div>
            <div class="card-body p-3">`

        rounds.forEach((round, ri) => {
            html += `<h6 class="fw-bold mt-${ri > 0 ? 3 : 0} mb-2">Journée ${ri + 1}</h6><div class="row g-2">`
            let terrain = 1
            round.forEach(match => {
                if (match.home === 'BYE' || match.away === 'BYE') return
                const key = `${ri}-${match.home}-${match.away}`
                html += `
                <div class="col-md-6 col-lg-4">
                    <div class="border rounded p-2 bg-light">
                        <div class="d-flex align-items-center gap-2 mb-1">
                            <span class="badge bg-secondary">Terrain ${terrain <= nbTerrains ? terrain : terrain % nbTerrains || nbTerrains}</span>
                            <small class="text-muted">${duration} min</small>
                        </div>
                        <div class="d-flex align-items-center justify-content-between">
                            <span class="fw-semibold small flex-fill">${this.escapeHtml(match.home)}</span>
                            <div class="d-flex align-items-center gap-1 mx-2">
                                <input type="number" class="form-control form-control-sm text-center p-1"
                                       style="width:42px" min="0" value=""
                                       data-key="${key}-home" data-action="input->tournoi#updateScore">
                                <span class="fw-bold text-muted">—</span>
                                <input type="number" class="form-control form-control-sm text-center p-1"
                                       style="width:42px" min="0" value=""
                                       data-key="${key}-away" data-action="input->tournoi#updateScore">
                            </div>
                            <span class="fw-semibold small flex-fill text-end">${this.escapeHtml(match.away)}</span>
                        </div>
                    </div>
                </div>`
                terrain++
            })
            html += `</div>`
        })

        html += `</div></div>` + this.renderStandings()
        this.bracketDisplayTarget.innerHTML = html
    }

    generateRoundRobin(teams) {
        const n = teams.length
        const rounds = []
        const arr = [...teams]
        const fixed = arr[0]
        const rotating = arr.slice(1)
        for (let r = 0; r < n - 1; r++) {
            const round = [{ home: fixed, away: rotating[r % rotating.length] }]
            for (let i = 1; i < n / 2; i++) {
                round.push({
                    home: rotating[(r + i) % rotating.length],
                    away: rotating[(r + rotating.length - i) % rotating.length],
                })
            }
            rounds.push(round)
        }
        return rounds
    }

    renderStandings() {
        const teamNames = this.teams.filter(t => t !== 'BYE')
        return `
        <div class="card border-0 shadow-sm">
            <div class="card-header bg-white border-0 py-2 px-3">
                <strong>📊 Classement</strong>
                <span class="text-muted small ms-2">(mis à jour en saisissant les scores · tri : Pts → G.A. → Buts+)</span>
            </div>
            <div class="table-responsive">
                <table class="table table-sm mb-0 align-middle" id="standingsTable">
                    <thead class="table-light">
                        <tr>
                            <th style="width:28px" class="text-center">#</th>
                            <th>Équipe</th>
                            <th class="text-center" title="Matchs joués">J</th>
                            <th class="text-center text-success" title="Victoires">V</th>
                            <th class="text-center text-muted" title="Nuls">N</th>
                            <th class="text-center text-danger" title="Défaites">D</th>
                            <th class="text-center" title="Buts pour">B+</th>
                            <th class="text-center" title="Buts contre">B-</th>
                            <th class="text-center fw-semibold" title="Goal-average (buts pour − buts contre)">G.A.</th>
                            <th class="text-center fw-bold" title="Points">Pts</th>
                        </tr>
                    </thead>
                    <tbody id="standingsTbody">
                        ${teamNames.map(t => `
                        <tr data-team="${this.escapeHtml(t)}">
                            <td class="text-center" data-stat="rank"><span class="badge bg-light text-dark border">—</span></td>
                            <td class="fw-semibold">${this.escapeHtml(t)}</td>
                            <td class="text-center text-muted"      data-stat="j">0</td>
                            <td class="text-center text-success fw-semibold" data-stat="g">0</td>
                            <td class="text-center text-muted"      data-stat="n">0</td>
                            <td class="text-center text-danger"     data-stat="p">0</td>
                            <td class="text-center"                 data-stat="bp">0</td>
                            <td class="text-center"                 data-stat="bc">0</td>
                            <td class="text-center fw-semibold"     data-stat="ga">0</td>
                            <td class="text-center fw-bold fs-6"    data-stat="pts">0</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`
    }

    updateScore() {
        const teamNames = this.teams.filter(t => t !== 'BYE')
        const stats = {}
        teamNames.forEach(t => { stats[t] = { pts: 0, j: 0, g: 0, n: 0, p: 0, bp: 0, bc: 0 } })

        const matches = {}
        this.element.querySelectorAll('input[data-key]').forEach(input => {
            const key  = input.dataset.key
            const side = key.endsWith('-home') ? 'home' : 'away'
            const base = key.slice(0, key.lastIndexOf('-'))
            if (!matches[base]) {
                const parts = base.split('-')  // [round, home, away]
                matches[base] = { home: parts.slice(1, -1).join('-'), away: parts[parts.length - 1] }
            }
            matches[base][side + 'Score'] = parseInt(input.value)
        })

        Object.values(matches).forEach(m => {
            const hs = m.homeScore, as = m.awayScore
            if (isNaN(hs) || isNaN(as) || !stats[m.home] || !stats[m.away]) return
            stats[m.home].j++;  stats[m.away].j++
            stats[m.home].bp += hs; stats[m.home].bc += as
            stats[m.away].bp += as; stats[m.away].bc += hs
            if (hs > as) {
                stats[m.home].g++; stats[m.home].pts += 3; stats[m.away].p++
            } else if (hs < as) {
                stats[m.away].g++; stats[m.away].pts += 3; stats[m.home].p++
            } else {
                stats[m.home].n++; stats[m.home].pts++
                stats[m.away].n++; stats[m.away].pts++
            }
        })

        const tbody = this.element.querySelector('#standingsTbody')
        if (!tbody) return

        // Sort: points → goal average → buts pour
        const rows = [...tbody.querySelectorAll('tr')]
        rows.sort((a, b) => {
            const sa = stats[a.dataset.team], sb = stats[b.dataset.team]
            if (!sa || !sb) return 0
            if (sb.pts !== sa.pts) return sb.pts - sa.pts
            const gaA = sa.bp - sa.bc, gaB = sb.bp - sb.bc
            if (gaB !== gaA) return gaB - gaA
            return sb.bp - sa.bp  // buts pour en dernier critère
        })

        const rankColors = ['bg-warning text-dark', 'bg-secondary text-white', 'bg-danger bg-opacity-75 text-white']
        rows.forEach((row, rank) => {
            const t  = row.dataset.team
            const st = stats[t]
            if (!st) return
            const ga = st.bp - st.bc
            row.querySelector('[data-stat="rank"]').innerHTML =
                `<span class="badge ${rankColors[rank] ?? 'bg-light text-dark border'}">${rank + 1}</span>`
            row.querySelector('[data-stat="j"]').textContent   = st.j
            row.querySelector('[data-stat="g"]').textContent   = st.g
            row.querySelector('[data-stat="n"]').textContent   = st.n
            row.querySelector('[data-stat="p"]').textContent   = st.p
            row.querySelector('[data-stat="bp"]').textContent  = st.bp
            row.querySelector('[data-stat="bc"]').textContent  = st.bc
            const gaCell = row.querySelector('[data-stat="ga"]')
            gaCell.textContent = ga > 0 ? `+${ga}` : ga
            gaCell.className = `text-center fw-semibold ${ga > 0 ? 'text-success' : ga < 0 ? 'text-danger' : 'text-muted'}`
            row.querySelector('[data-stat="pts"]').textContent = st.pts
            tbody.appendChild(row)
        })
    }

    // ── Elimination ────────────────────────────────────────────────────────

    renderElimination() {
        this.consolationBracket = null
        const realTeams = [...this.teams]
        const size  = Math.pow(2, Math.ceil(Math.log2(realTeams.length)))
        const nByes = size - realTeams.length

        this.shuffle(realTeams)

        // ── Placement des BYEs : distribués uniformément sur tout le tableau ─
        // Chaque BYE occupe la 2e place (impaire) d'une paire différente,
        // espacées régulièrement → les exemptés atterrissent dans des moitiés
        // opposées du tableau et ne peuvent pas se retrouver avant la finale.
        const padded = new Array(size).fill(null)
        for (let i = 0; i < nByes; i++) {
            // Position impaire (2e de paire) répartie régulièrement
            let pos = Math.floor((i + 1) * size / nByes) - 1
            if (pos % 2 === 0) pos--       // forcer position impaire
            if (pos < 1)       pos = 1     // sécurité
            if (pos >= size)   pos = size - 1
            // En cas de collision (nByes > size/2), décaler
            while (padded[pos] !== null) pos = (pos + 2) % size || 1
            padded[pos] = 'BYE'
        }
        let ti = 0
        for (let i = 0; i < size; i++) { if (padded[i] === null) padded[i] = realTeams[ti++] }

        // ── Build round 1 ────────────────────────────────────────────────
        const round1 = []
        for (let i = 0; i < size; i += 2) {
            const m = { home: padded[i], away: padded[i + 1], winner: null }
            if (m.away === 'BYE') m.winner = m.home   // home exempt
            if (m.home === 'BYE') m.winner = m.away   // away exempt (cas impossible avec algo ci-dessus)
            round1.push(m)
        }

        // ── Build subsequent empty rounds ────────────────────────────────
        this.bracket = [round1]
        let prev = round1
        while (prev.length > 1) {
            const next = Array.from({ length: Math.ceil(prev.length / 2) }, () => ({ home: '?', away: '?', winner: null }))
            this.bracket.push(next)
            prev = next
        }

        // ── Propagate BYE auto-advances ──────────────────────────────────
        this._propagateBracket()
        this._renderBracketHtml()
    }

    _propagateBracket(bracket = this.bracket) {
        for (let r = 0; r < bracket.length - 1; r++) {
            bracket[r].forEach((match, mi) => {
                // Ne propage que les vrais gagnants (pas 'BYE' ni '?')
                if (match.winner && match.winner !== 'BYE' && match.winner !== '?') {
                    const next = bracket[r + 1][Math.floor(mi / 2)]
                    if (mi % 2 === 0) next.home = match.winner
                    else              next.away = match.winner
                }
            })
        }
    }

    _resetFromMatch(round, mi, bracket = this.bracket) {
        const match = bracket[round]?.[mi]
        if (!match || !match.winner) return
        // Cascade: clear the slot this winner occupied in next round
        if (round + 1 < bracket.length) {
            const next     = bracket[round + 1][Math.floor(mi / 2)]
            const slotKey  = mi % 2 === 0 ? 'home' : 'away'
            if (next[slotKey] === match.winner) {
                next[slotKey] = '?'
                this._resetFromMatch(round + 1, Math.floor(mi / 2), bracket)
            }
        }
        match.winner = null
    }

    _buildBracketHtml(bracket, bracketKey, unit = null) {
        const ROUND_NAMES = ['Finale', 'Demi-finales', 'Quarts de finale', 'Huitièmes', 'Seizièmes', 'Trentièmes']
        const totalRounds = bracket.length
        const firstRoundN = bracket[0].length
        const teamCount   = bracket[0].reduce((n, m) => n + (m.home !== 'BYE' ? 1 : 0) + (m.away !== 'BYE' ? 1 : 0), 0)

        const TARGET_H  = 580
        const GAP_BASE  = 8
        const UNIT      = unit ?? Math.max(32, Math.min(60, Math.floor((TARGET_H + GAP_BASE) / firstRoundN)))
        const compact   = UNIT < 48
        const cellPad   = compact ? 'py-1 px-2' : 'p-2'
        const cellStyle = compact ? 'font-size:.78rem;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px' : 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:160px'
        const colWidth  = compact ? '140px' : '180px'
        const scrollY   = teamCount > 30 ? 'auto' : 'visible'
        const maxH      = teamCount > 30 ? '640px' : 'none'

        const isConsolation = bracketKey === 'consolation'
        const title = isConsolation
            ? `🥈 Tournoi de consolation <small class="text-muted fw-normal">(${teamCount} perdants)</small>`
            : `🏆 Tableau d'élimination directe <small class="text-muted fw-normal">(${teamCount} joueurs)</small>`

        let html = `<div class="card border-0 shadow-sm mb-3"><div class="card-body p-2 p-md-3">`
        html += `<div class="d-flex align-items-center justify-content-between mb-2">`
        html += `<h6 class="fw-bold mb-0">${title}</h6>`
        if (isConsolation) {
            html += `<button class="btn btn-sm btn-outline-secondary py-0 px-2" data-consolation-action="reset"><i class="bi bi-x me-1"></i>Supprimer</button>`
        }
        html += `</div>`
        html += `<div class="d-flex gap-2 pb-2 align-items-start" style="overflow-x:auto;overflow-y:${scrollY};max-height:${maxH}">`

        bracket.forEach((round, ri) => {
            const roundName  = ROUND_NAMES[totalRounds - 1 - ri] ?? `Tour ${ri + 1}`
            const paddingTop = ri === 0 ? 0 : (Math.pow(2, ri) - 1) * ((UNIT - GAP_BASE) / 2)
            const gap        = Math.pow(2, ri) * UNIT - UNIT + GAP_BASE

            html += `<div class="flex-shrink-0" style="min-width:${colWidth}">`
            html += `<div class="text-center mb-1 text-muted fw-semibold" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.04em">${roundName}</div>`
            html += `<div class="d-flex flex-column" style="padding-top:${paddingTop}px;gap:${gap}px">`

            round.forEach((match, mi) => {
                const isBye = match.home === 'BYE' || match.away === 'BYE'

                if (isBye) {
                    const qualifier = match.home === 'BYE' ? match.away : match.home
                    html += `<div class="border rounded overflow-hidden">
                        <div class="${cellPad} fw-semibold bg-success bg-opacity-10 d-flex align-items-center justify-content-between gap-1" style="${cellStyle}">
                            <span class="text-truncate">${this.escapeHtml(qualifier)}</span>
                            <span class="badge bg-secondary flex-shrink-0" style="font-size:.6rem">Ext.</span>
                        </div>
                    </div>`
                    return
                }

                const homeWon     = match.winner === match.home
                const awayWon     = match.winner === match.away
                const homePending = match.home === '?'
                const awayPending = match.away === '?'

                const homeClass = homeWon     ? 'bg-success text-white fw-bold'
                                : homePending ? 'text-muted fst-italic bg-light'
                                : 'fw-semibold bg-light'
                const awayClass = awayWon     ? 'bg-success text-white fw-bold'
                                : awayPending ? 'text-muted fst-italic'
                                : 'fw-semibold'

                html += `<div class="border rounded overflow-hidden">
                    <div class="${cellPad} border-bottom ${homeClass}"
                         style="cursor:${!homePending ? 'pointer' : 'default'};${cellStyle}"
                         ${!homePending ? `data-pick-bracket="${bracketKey}" data-pick-round="${ri}" data-pick-match="${mi}" data-pick-side="home"` : ''}>
                        ${this.escapeHtml(match.home)}${homeWon ? ' ✓' : ''}
                    </div>
                    <div class="${cellPad} ${awayClass}"
                         style="cursor:${!awayPending ? 'pointer' : 'default'};${cellStyle}"
                         ${!awayPending ? `data-pick-bracket="${bracketKey}" data-pick-round="${ri}" data-pick-match="${mi}" data-pick-side="away"` : ''}>
                        ${this.escapeHtml(match.away)}${awayWon ? ' ✓' : ''}
                    </div>
                </div>`
            })

            html += `</div></div>`
        })

        // Trophée si finale jouée
        const finalMatch = bracket[bracket.length - 1]?.[0]
        if (finalMatch?.winner && finalMatch.winner !== '?') {
            const trophyPad = (Math.pow(2, totalRounds - 1) - 1) * ((UNIT - GAP_BASE) / 2)
            const icon = isConsolation ? '🥈' : '🏆'
            html += `<div class="flex-shrink-0 d-flex align-items-start" style="min-width:100px;padding-top:${trophyPad}px">
                <div class="text-center p-2 rounded-3 border w-100" style="background:#fff9e6">
                    <div class="fs-3 mb-1">${icon}</div>
                    <div class="fw-bold small">${this.escapeHtml(finalMatch.winner)}</div>
                </div>
            </div>`
        }

        html += `</div></div></div>`
        return html
    }

    _renderBracketHtml() {
        const mainFirstRoundN = this.bracket[0].length
        const UNIT = Math.max(32, Math.min(60, Math.floor((580 + 8) / mainFirstRoundN)))

        let html = this._buildBracketHtml(this.bracket, 'main', UNIT)

        if (this.consolationBracket) {
            html += this._buildBracketHtml(this.consolationBracket, 'consolation', UNIT)
        } else {
            const losers = this._getR1Losers()
            if (losers.length >= 2) {
                html += `<div class="text-center mt-2">
                    <button class="btn btn-sm btn-outline-secondary" data-consolation-action="build">
                        <i class="bi bi-trophy me-1"></i>Créer le tournoi de consolation (${losers.length} perdant${losers.length > 1 ? 's' : ''})
                    </button>
                </div>`
            }
        }

        this.bracketDisplayTarget.innerHTML = html

        // Attach click listeners directly (data-action on innerHTML is unreliable with Stimulus)
        this.bracketDisplayTarget.querySelectorAll('[data-pick-round]').forEach(el => {
            el.addEventListener('click', () => {
                this._handlePickWinner(
                    parseInt(el.dataset.pickRound),
                    parseInt(el.dataset.pickMatch),
                    el.dataset.pickSide,
                    el.dataset.pickBracket || 'main'
                )
            })
        })

        const buildBtn = this.bracketDisplayTarget.querySelector('[data-consolation-action="build"]')
        if (buildBtn) buildBtn.addEventListener('click', () => this.buildConsolation())

        const resetBtn = this.bracketDisplayTarget.querySelector('[data-consolation-action="reset"]')
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetConsolation())
    }

    _handlePickWinner(ri, mi, side, bracketKey = 'main') {
        const bracket = bracketKey === 'consolation' ? this.consolationBracket : this.bracket
        const match = bracket[ri][mi]

        // Reset any previously cascaded choices from this match
        this._resetFromMatch(ri, mi, bracket)

        // Set new winner and propagate one round forward
        match.winner = side === 'home' ? match.home : match.away
        if (ri + 1 < bracket.length) {
            const next = bracket[ri + 1][Math.floor(mi / 2)]
            if (mi % 2 === 0) next.home = match.winner
            else              next.away = match.winner
        }

        this._renderBracketHtml()
    }

    _getR1Losers() {
        if (!this.bracket?.[0]) return []
        return this.bracket[0]
            .filter(m => m.winner && m.winner !== '?' && m.home !== 'BYE' && m.away !== 'BYE')
            .map(m => m.winner === m.home ? m.away : m.home)
    }

    buildConsolation() {
        const losers = this._getR1Losers()
        if (losers.length < 2) return

        const size  = Math.pow(2, Math.ceil(Math.log2(losers.length)))
        const nByes = size - losers.length
        const shuffled = [...losers]
        this.shuffle(shuffled)

        const padded = new Array(size).fill(null)
        for (let i = 0; i < nByes; i++) {
            let pos = Math.floor((i + 1) * size / nByes) - 1
            if (pos % 2 === 0) pos--
            if (pos < 1)       pos = 1
            if (pos >= size)   pos = size - 1
            while (padded[pos] !== null) pos = (pos + 2) % size || 1
            padded[pos] = 'BYE'
        }
        let ti = 0
        for (let i = 0; i < size; i++) { if (padded[i] === null) padded[i] = shuffled[ti++] }

        const round1 = []
        for (let i = 0; i < size; i += 2) {
            const m = { home: padded[i], away: padded[i + 1], winner: null }
            if (m.away === 'BYE') m.winner = m.home
            if (m.home === 'BYE') m.winner = m.away
            round1.push(m)
        }

        this.consolationBracket = [round1]
        let prev = round1
        while (prev.length > 1) {
            const next = Array.from({ length: Math.ceil(prev.length / 2) }, () => ({ home: '?', away: '?', winner: null }))
            this.consolationBracket.push(next)
            prev = next
        }

        this._propagateBracket(this.consolationBracket)
        this._renderBracketHtml()
    }

    resetConsolation() {
        this.consolationBracket = null
        this._renderBracketHtml()
    }

    // ── Rank-adjust toggle ─────────────────────────────────────────────────

    toggleRankAdjust() {
        this.rankAdjustConfigTarget.style.display = this.rankAdjustInputTarget.checked ? '' : 'none'
    }

    // ── Défi mode ──────────────────────────────────────────────────────────

    _defiSorted() {
        return [...this.teams].sort((a, b) => {
            const sa = this.defiStats[a], sb = this.defiStats[b]
            if (sb.pts !== sa.pts) return sb.pts - sa.pts
            if (sb.g   !== sa.g)   return sb.g   - sa.g
            return sa.j - sb.j  // fewer matches = slightly favored tiebreak
        })
    }

    renderDefi() {
        const container = this.bracketDisplayTarget
        container.innerHTML = ''

        const sorted  = this._defiSorted()

        // ── Match form ────────────────────────────────────────────────────
        const matchCard = document.createElement('div')
        matchCard.className = 'card border-0 shadow-sm mb-3'

        const formDiv = document.createElement('div')
        formDiv.innerHTML = `
            <div class="card-header bg-white border-0 py-2 px-3">
                <strong>🥊 Enregistrer un défi</strong>
            </div>
            <div class="card-body p-3">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <select class="form-select form-select-sm js-p1" style="width:auto;min-width:150px"></select>
                    <input type="number" class="form-control form-control-sm text-center js-s1"
                           style="width:62px" min="0" placeholder="0">
                    <span class="fw-bold text-muted px-1">—</span>
                    <input type="number" class="form-control form-control-sm text-center js-s2"
                           style="width:62px" min="0" placeholder="0">
                    <select class="form-select form-select-sm js-p2" style="width:auto;min-width:150px"></select>
                    <button class="btn btn-primary btn-sm js-submit">
                        <i class="bi bi-check-lg me-1"></i>Valider
                    </button>
                </div>
                <div class="small text-muted mt-2 js-preview"></div>
            </div>
        `
        matchCard.appendChild(formDiv)

        // Populate player selects
        const sel1 = formDiv.querySelector('.js-p1')
        const sel2 = formDiv.querySelector('.js-p2')
        sorted.forEach((name, i) => {
            sel1.add(new Option(`${i + 1}. ${name}`, name))
            sel2.add(new Option(`${i + 1}. ${name}`, name))
        })
        if (sorted.length >= 2) sel2.value = sorted[1]

        // Live points preview
        const preview = formDiv.querySelector('.js-preview')
        const updatePreview = () => {
            const p1 = sel1.value, p2 = sel2.value
            if (!p1 || !p2 || p1 === p2) { preview.innerHTML = ''; return }
            const wPts   = parseInt(this.winPtsInputTarget.value)  || 3
            const dPts   = parseInt(this.drawPtsInputTarget.value) || 1
            const lPts   = parseInt(this.lossPtsInputTarget.value) || 0
            const useAdj = this.rankAdjustInputTarget.checked
            const rBonus = useAdj ? (parseInt(this.rankBonusInputTarget.value) || 0) : 0
            const rMalus = useAdj ? (parseInt(this.rankMalusInputTarget.value) || 0) : 0
            const rMax     = useAdj ? (parseInt(this.rankMaxInputTarget.value)     || Infinity) : Infinity
            const rMaxLoss = useAdj ? (parseInt(this.rankMaxLossInputTarget.value) || Infinity) : Infinity
            const r1 = sorted.indexOf(p1) + 1
            const r2 = sorted.indexOf(p2) + 1
            const { winnerPts: w1 } = this._calcRankPts(r1, r2, wPts, lPts, rBonus, rMalus, rMax, rMaxLoss)
            const { winnerPts: w2 } = this._calcRankPts(r2, r1, wPts, lPts, rBonus, rMalus, rMax, rMaxLoss)
            const sn = n => this.escapeHtml(n.split(' ')[0])
            if (useAdj) {
                preview.innerHTML = `Si <b>${sn(p1)}</b> gagne : <span class="text-success fw-semibold">+${w1} pts</span>`
                    + ` &nbsp;·&nbsp; Si <b>${sn(p2)}</b> gagne : <span class="text-success fw-semibold">+${w2} pts</span>`
                    + ` &nbsp;·&nbsp; Nul : +${dPts} pt`
            } else {
                preview.textContent = `V : +${wPts} pts · N : +${dPts} pt · D : +${lPts} pt`
            }
        }
        sel1.addEventListener('change', updatePreview)
        sel2.addEventListener('change', updatePreview)
        updatePreview()

        formDiv.querySelector('.js-submit').addEventListener('click', () => {
            const p1 = sel1.value
            const p2 = sel2.value
            const s1 = parseInt(formDiv.querySelector('.js-s1').value)
            const s2 = parseInt(formDiv.querySelector('.js-s2').value)
            if (!p1 || !p2 || p1 === p2) {
                showAlert('Sélectionnez deux joueurs différents.', { type: 'info', title: 'Joueurs invalides' })
                return
            }
            if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
                showAlert('Saisissez des scores valides (≥ 0).', { type: 'info', title: 'Score invalide' })
                return
            }
            this._submitDefiMatch(p1, p2, s1, s2)
        })

        container.appendChild(matchCard)

        // ── Two-column: rankings + history ─────────────────────────────────
        const row = document.createElement('div')
        row.className = 'row g-3'

        // Rankings
        const rankCol = document.createElement('div')
        rankCol.className = 'col-lg-7'
        const rankCard = document.createElement('div')
        rankCard.className = 'card border-0 shadow-sm'
        rankCard.innerHTML = `
            <div class="card-header bg-white border-0 py-2 px-3 d-flex align-items-center justify-content-between">
                <strong>🏆 Classement</strong>
                <span class="text-muted small">${this.defiHistory.length} défi(s) disputé(s)</span>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-hover mb-0 align-middle">
                    <thead class="table-light">
                        <tr>
                            <th style="width:44px" class="text-center">#</th>
                            <th style="width:22px"></th>
                            <th>Joueur</th>
                            <th class="text-center" title="Matchs joués">J</th>
                            <th class="text-center text-success">V</th>
                            <th class="text-center text-muted">N</th>
                            <th class="text-center text-danger">D</th>
                            <th class="text-center fw-bold">Pts</th>
                        </tr>
                    </thead>
                    <tbody class="js-tbody"></tbody>
                </table>
            </div>
        `
        const tbody = rankCard.querySelector('.js-tbody')
        const rankColors = ['bg-warning text-dark', 'bg-secondary text-white', 'bg-danger bg-opacity-75 text-white']

        sorted.forEach((name, i) => {
            const rank  = i + 1
            const stats = this.defiStats[name]
            const prev  = this.defiPrevRanks[name]
            let arrow = ''
            if (prev !== undefined && prev !== rank) {
                arrow = rank < prev
                    ? `<span class="text-success fw-bold" title="↑ ${prev}→${rank}">▲</span>`
                    : `<span class="text-danger fw-bold"  title="↓ ${prev}→${rank}">▼</span>`
            }
            const badgeClass = rankColors[i] ?? 'bg-light text-dark border'
            const tr = document.createElement('tr')
            tr.innerHTML = `
                <td class="text-center"><span class="badge ${badgeClass}">${rank}</span></td>
                <td class="text-center" style="font-size:.8rem">${arrow}</td>
                <td class="fw-semibold">${this.escapeHtml(name)}</td>
                <td class="text-center text-muted small">${stats.j}</td>
                <td class="text-center text-success fw-semibold">${stats.g}</td>
                <td class="text-center text-muted">${stats.n}</td>
                <td class="text-center text-danger">${stats.p}</td>
                <td class="text-center fw-bold fs-6">${stats.pts}</td>
            `
            tbody.appendChild(tr)
        })

        rankCol.appendChild(rankCard)
        row.appendChild(rankCol)

        // History
        const histCol = document.createElement('div')
        histCol.className = 'col-lg-5'
        const histCard = document.createElement('div')
        histCard.className = 'card border-0 shadow-sm h-100'

        const histItems = this.defiHistory.slice().reverse().map((m, ri) => {
            const n      = this.defiHistory.length - ri
            const winner = m.s1 > m.s2 ? m.p1 : m.s2 > m.s1 ? m.p2 : null
            return `
                <div class="d-flex align-items-center gap-2 py-1 px-2 border-bottom small">
                    <span class="text-muted" style="min-width:26px">#${n}</span>
                    <span class="flex-fill text-end ${winner === m.p1 ? 'fw-bold text-success' : 'text-muted'}">${this.escapeHtml(m.p1)}</span>
                    <span class="badge bg-dark font-monospace px-2">${m.s1}–${m.s2}</span>
                    <span class="flex-fill ${winner === m.p2 ? 'fw-bold text-success' : 'text-muted'}">${this.escapeHtml(m.p2)}</span>
                </div>`
        }).join('')

        histCard.innerHTML = `
            <div class="card-header bg-white border-0 py-2 px-3">
                <strong>📋 Historique des défis</strong>
            </div>
            <div style="max-height:400px;overflow-y:auto">
                ${histItems || '<p class="text-muted small text-center py-4 mb-0">Aucun défi enregistré.</p>'}
            </div>
        `
        histCol.appendChild(histCard)
        row.appendChild(histCol)

        container.appendChild(row)
    }

    _submitDefiMatch(p1, p2, s1, s2) {
        // Snapshot current ranks for movement arrows
        const prevSorted = this._defiSorted()
        this.defiPrevRanks = {}
        prevSorted.forEach((name, i) => { this.defiPrevRanks[name] = i + 1 })

        const winPts  = parseInt(this.winPtsInputTarget.value)  || 3
        const drawPts = parseInt(this.drawPtsInputTarget.value) || 1
        const lossPts = parseInt(this.lossPtsInputTarget.value) || 0
        const useAdj  = this.rankAdjustInputTarget.checked
        const rBonus  = useAdj ? (parseInt(this.rankBonusInputTarget.value) || 0) : 0
        const rMalus  = useAdj ? (parseInt(this.rankMalusInputTarget.value) || 0) : 0
        const rMax     = useAdj ? (parseInt(this.rankMaxInputTarget.value)     || Infinity) : Infinity
        const rMaxLoss = useAdj ? (parseInt(this.rankMaxLossInputTarget.value) || Infinity) : Infinity

        const r1 = this.defiPrevRanks[p1]
        const r2 = this.defiPrevRanks[p2]

        this.defiStats[p1].j++
        this.defiStats[p2].j++

        if (s1 > s2) {
            const { winnerPts, loserPts } = this._calcRankPts(r1, r2, winPts, lossPts, rBonus, rMalus, rMax, rMaxLoss)
            this.defiStats[p1].g++; this.defiStats[p1].pts += winnerPts
            this.defiStats[p2].p++; this.defiStats[p2].pts += loserPts
        } else if (s1 < s2) {
            const { winnerPts, loserPts } = this._calcRankPts(r2, r1, winPts, lossPts, rBonus, rMalus, rMax, rMaxLoss)
            this.defiStats[p2].g++; this.defiStats[p2].pts += winnerPts
            this.defiStats[p1].p++; this.defiStats[p1].pts += loserPts
        } else {
            this.defiStats[p1].n++; this.defiStats[p1].pts += drawPts
            this.defiStats[p2].n++; this.defiStats[p2].pts += drawPts
        }

        this.defiHistory.push({ p1, p2, s1, s2, r1, r2 })
        this.renderDefi()
    }

    /**
     * Calculate points for winner and loser based on their ranks before the match.
     * @param {number} winnerRank  rank of the winner before match (1 = best)
     * @param {number} loserRank   rank of the loser before match
     * @param {number} winPts      base win points
     * @param {number} lossPts     base loss points
     * @param {number} rBonus      bonus pts per rank gap when underdog wins
     * @param {number} rMalus      malus pts per rank gap when favourite wins
     */
    _calcRankPts(winnerRank, loserRank, winPts, lossPts, rBonus, rMalus, rMax = Infinity, rMaxLoss = Infinity) {
        const gap = Math.abs(winnerRank - loserRank)
        let winnerPts
        if (winnerRank > loserRank) {
            // Upset: lower-ranked beats higher-ranked → bonus, capped at rMax
            winnerPts = Math.min(rMax, winPts + gap * rBonus)
        } else {
            // Favourite wins → malus; can't lose more than rMaxLoss pts, minimum 1 pt
            // Math.max picks the highest floor: either (winPts - rMaxLoss) or 1
            winnerPts = Math.max(1, winPts - rMaxLoss, winPts - gap * rMalus)
        }
        return { winnerPts, loserPts: lossPts }
    }

    // ── Save / Load ────────────────────────────────────────────────────────

    async saveState() {
        if (this.teams.length === 0) {
            await showAlert('Configurez d\'abord un tournoi avant de sauvegarder.', { type: 'info', title: 'Rien à sauvegarder' })
            return
        }
        const label = await showSaveDialog()
        if (label === null) return

        const btn = this.saveBtnTarget
        btn.disabled = true

        const state = {
            mode:  this.mode,
            teams: this.teams,
            config: {
                nbTerrains:  this.nbTerrainsInputTarget.value,
                duration:    this.durationInputTarget.value,
                winPts:      this.winPtsInputTarget.value,
                drawPts:     this.drawPtsInputTarget.value,
                lossPts:     this.lossPtsInputTarget.value,
                rankAdjust:  this.rankAdjustInputTarget.checked,
                rankBonus:   this.rankBonusInputTarget.value,
                rankMalus:   this.rankMalusInputTarget.value,
                rankMax:     this.rankMaxInputTarget.value,
                rankMaxLoss: this.rankMaxLossInputTarget.value,
            },
            // Round-robin: capture all current scores from inputs
            rrScores: this._collectRrScores(),
            // Défi: full state
            defiStats:      this.defiStats,
            defiHistory:    this.defiHistory,
            defiPrevRanks:  this.defiPrevRanks,
        }

        try {
            const res = await fetch('/api/resultats', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outil: 'tournoi', classeId: this.classeIdValue, label, data: state }),
            })
            if (!res.ok) throw new Error()
            btn.innerHTML = '<i class="bi bi-check-lg me-1"></i>Sauvegardé !'
            btn.classList.replace('btn-outline-success', 'btn-success')
            setTimeout(() => {
                btn.innerHTML = '<i class="bi bi-cloud-upload-fill me-1"></i>Sauvegarder'
                btn.classList.replace('btn-success', 'btn-outline-success')
                btn.disabled = false
            }, 2500)
        } catch {
            btn.innerHTML = '<i class="bi bi-x-lg me-1"></i>Erreur'
            setTimeout(() => {
                btn.innerHTML = '<i class="bi bi-cloud-upload-fill me-1"></i>Sauvegarder'
                btn.disabled = false
            }, 2500)
        }
    }

    _collectRrScores() {
        const scores = {}
        this.element.querySelectorAll('input[data-key]').forEach(input => {
            if (input.value !== '') scores[input.dataset.key] = parseInt(input.value)
        })
        return scores
    }

    async toggleLoadPanel() {
        const panel = this.loadPanelTarget
        if (panel.style.display !== 'none') {
            panel.style.display = 'none'
            return
        }
        panel.style.display = ''
        this.loadListTarget.innerHTML = '<p class="text-muted small text-center py-2 mb-0">Chargement…</p>'
        try {
            const res = await fetch(`/api/resultats?classeId=${this.classeIdValue}&outil=tournoi`, { credentials: 'same-origin' })
            const saves = await res.json()
            this._renderLoadList(saves)
        } catch {
            this.loadListTarget.innerHTML = '<p class="text-danger small text-center py-2 mb-0">Erreur de chargement.</p>'
        }
    }

    closeLoadPanel() {
        this.loadPanelTarget.style.display = 'none'
    }

    _renderLoadList(saves) {
        const list = this.loadListTarget
        if (!saves.length) {
            list.innerHTML = '<p class="text-muted small text-center py-2 mb-0">Aucune sauvegarde pour cette classe.</p>'
            return
        }
        list.innerHTML = ''
        const MODES = { roundrobin: 'Poules', elimination: 'Élimination', defi: 'Défi' }
        saves.forEach(save => {
            const row = document.createElement('div')
            row.className = 'd-flex align-items-center gap-2 px-2 py-1 border-bottom small'
            row.innerHTML = `
                <div class="flex-grow-1">
                    <div class="fw-semibold">${this.escapeHtml(save.label)}</div>
                    <div class="text-muted" style="font-size:.72rem">${save.outil ? (MODES[save.outil] ?? save.outil) + ' · ' : ''}${save.createdAt}</div>
                </div>
                <button class="btn btn-sm btn-outline-primary py-0 px-2">Charger</button>
            `
            row.querySelector('button').addEventListener('click', () => this._loadSave(save.id))
            list.appendChild(row)
        })
    }

    async _loadSave(id) {
        try {
            const res = await fetch(`/api/resultats/${id}`, { credentials: 'same-origin' })
            if (!res.ok) throw new Error()
            const { data } = await res.json()
            this.closeLoadPanel()
            this._restoreState(data)
        } catch {
            await showAlert('Impossible de charger cette sauvegarde.', { type: 'danger', title: 'Erreur' })
        }
    }

    _restoreState(data) {
        // ── Mode ──────────────────────────────────────────────────────────
        this.mode = data.mode ?? 'roundrobin'
        this.modeGroupTarget.querySelectorAll('button').forEach(btn => {
            btn.classList.toggle('btn-primary',         btn.dataset.mode === this.mode)
            btn.classList.toggle('btn-outline-primary', btn.dataset.mode !== this.mode)
        })
        const isDefi = this.mode === 'defi'
        this.defiConfigTarget.style.display     = isDefi ? '' : 'none'
        document.getElementById('nbTerrainsWrap').style.display = isDefi ? 'none' : ''
        document.getElementById('durationWrap').style.display   = isDefi ? 'none' : ''
        this.autoTeamsLabelTarget.textContent = 'Charger les élèves'
        this.addLabelTarget.textContent       = isDefi ? 'Ajouter un joueur'  : 'Ajouter une équipe'
        this.teamListLabelTarget.textContent  = isDefi ? 'Joueurs'            : 'Équipes / Participants'

        // ── Teams ──────────────────────────────────────────────────────────
        this.teams = data.teams ?? []
        this.renderTeamList()

        // ── Config ─────────────────────────────────────────────────────────
        const c = data.config ?? {}
        if (c.nbTerrains  != null) this.nbTerrainsInputTarget.value    = c.nbTerrains
        if (c.duration    != null) this.durationInputTarget.value      = c.duration
        if (c.winPts      != null) this.winPtsInputTarget.value        = c.winPts
        if (c.drawPts     != null) this.drawPtsInputTarget.value       = c.drawPts
        if (c.lossPts     != null) this.lossPtsInputTarget.value       = c.lossPts
        if (c.rankAdjust  != null) {
            this.rankAdjustInputTarget.checked          = c.rankAdjust
            this.rankAdjustConfigTarget.style.display   = c.rankAdjust ? '' : 'none'
        }
        if (c.rankBonus   != null) this.rankBonusInputTarget.value     = c.rankBonus
        if (c.rankMalus   != null) this.rankMalusInputTarget.value     = c.rankMalus
        if (c.rankMax     != null) this.rankMaxInputTarget.value       = c.rankMax
        if (c.rankMaxLoss != null) this.rankMaxLossInputTarget.value   = c.rankMaxLoss

        // ── Game state ─────────────────────────────────────────────────────
        if (this.mode === 'defi') {
            this.defiStats      = data.defiStats     ?? {}
            this.defiHistory    = data.defiHistory   ?? []
            this.defiPrevRanks  = data.defiPrevRanks ?? {}
            if (this.teams.length >= 2) this.renderDefi()
        } else if (this.mode === 'roundrobin') {
            if (this.teams.length >= 2) {
                this.renderRoundRobin()
                // Restore scores after DOM is built
                const saved = data.rrScores ?? {}
                Object.entries(saved).forEach(([key, val]) => {
                    const input = this.element.querySelector(`input[data-key="${key}"]`)
                    if (input) input.value = val
                })
                if (Object.keys(saved).length) this.updateScore()
            }
        } else if (this.mode === 'elimination') {
            if (this.teams.length >= 2) this.renderElimination()
        }
    }

    // ── Utilities ──────────────────────────────────────────────────────────

    shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]]
        }
    }

    escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }
}
