import { Controller } from '@hotwired/stimulus'
import { showAlert, showConfirm, showSaveDialog } from '../utils/dialog.js'

export default class extends Controller {
    static targets = [
        'tableHead', 'tableBody', 'labelContainer', 'exportArea', 'exportText',
        'saveBtn',
        'tabletOverlay', 'tabletToggleBtn',
        'tabletStudentName', 'tabletStudentCounter', 'tabletActionButtons', 'tabletTotal',
    ]
    static values = { eleves: Array, classeId: Number }

    connect() {
        this.actionLabels = ['Action 1']
        this.counts = {} // { eleveId: [count, count, ...] }
        this.elevesValue.forEach(e => { this.counts[e.id] = [0] })
        this.tabletMode = false
        this.tabletCurrentIndex = 0
        this.render()
    }

    render() {
        this.renderLabels()
        this.renderTable()
    }

    // ── Labels ─────────────────────────────────────────────────────────

    renderLabels() {
        const container = this.labelContainerTarget
        container.innerHTML = ''
        this.actionLabels.forEach((label, i) => {
            const wrap = document.createElement('div')
            wrap.className = 'd-flex align-items-center gap-1'
            wrap.innerHTML = `
                <input type="text" class="form-control form-control-sm" style="width:130px"
                       value="${this.escapeHtml(label)}"
                       data-action="input->actions#renameLabel" data-col="${i}">
                ${this.actionLabels.length > 1
                    ? `<button class="btn btn-sm btn-outline-danger py-0 px-1" data-action="actions#removeActionType" data-col="${i}">✕</button>`
                    : ''}
            `
            container.appendChild(wrap)
        })
    }

    // ── Table ──────────────────────────────────────────────────────────

    renderTable() {
        this.tableHeadTarget.innerHTML = `
            <tr>
                <th>Élève</th>
                ${this.actionLabels.map(l => `<th class="text-center" style="min-width:140px">${this.escapeHtml(l)}</th>`).join('')}
                <th class="text-center">Total</th>
                ${this.tabletMode ? '<th style="width:50px"></th>' : ''}
            </tr>
        `
        this.tableBodyTarget.innerHTML = ''
        this.elevesValue.forEach((eleve, idx) => {
            const counts = this.counts[eleve.id] || this.actionLabels.map(() => 0)
            const total = counts.reduce((a, b) => a + b, 0)
            const row = document.createElement('tr')
            if (this.tabletMode) row.style.cursor = 'pointer'

            row.innerHTML = `
                <td class="fw-semibold">${this.escapeHtml(eleve.fullName)}
                    ${eleve.sexe === 'M' ? '<small class="text-info ms-1">M</small>' : eleve.sexe === 'F' ? '<small class="text-danger ms-1">F</small>' : ''}
                </td>
                ${counts.map((c, j) => `
                    <td class="text-center p-1">
                        <div class="d-flex align-items-center justify-content-center gap-1">
                            <button class="btn btn-sm btn-outline-secondary py-0 px-2"
                                    data-action="actions#decrement" data-eleve="${eleve.id}" data-col="${j}">−</button>
                            <span class="fw-bold fs-5 mx-1" style="min-width:28px"
                                  data-count="${eleve.id}-${j}">${c}</span>
                            <button class="btn btn-sm btn-primary py-0 px-2"
                                    data-action="actions#increment" data-eleve="${eleve.id}" data-col="${j}">+</button>
                        </div>
                    </td>
                `).join('')}
                <td class="text-center fw-bold fs-5 text-success" data-total="${eleve.id}">${total}</td>
                ${this.tabletMode
                    ? `<td class="text-center">
                           <button class="btn btn-sm btn-outline-primary py-0"
                                   data-action="actions#openTabletFor" data-index="${idx}">
                               <i class="bi bi-tablet"></i>
                           </button>
                       </td>`
                    : ''}
            `
            this.tableBodyTarget.appendChild(row)
        })
    }

    // ── Desktop increment / decrement ──────────────────────────────────

    increment(event) {
        const eleveId = parseInt(event.currentTarget.dataset.eleve)
        const col = parseInt(event.currentTarget.dataset.col)
        this.counts[eleveId][col] = (this.counts[eleveId][col] || 0) + 1
        this.updateCell(eleveId, col)
    }

    decrement(event) {
        const eleveId = parseInt(event.currentTarget.dataset.eleve)
        const col = parseInt(event.currentTarget.dataset.col)
        this.counts[eleveId][col] = Math.max(0, (this.counts[eleveId][col] || 0) - 1)
        this.updateCell(eleveId, col)
    }

    updateCell(eleveId, col) {
        const cell = this.element.querySelector(`[data-count="${eleveId}-${col}"]`)
        if (cell) cell.textContent = this.counts[eleveId][col]
        const total = this.counts[eleveId].reduce((a, b) => a + b, 0)
        const totalEl = this.element.querySelector(`[data-total="${eleveId}"]`)
        if (totalEl) totalEl.textContent = total
    }

    // ── Tablet mode ────────────────────────────────────────────────────

    toggleTablet() {
        this.tabletMode = !this.tabletMode
        const btn = this.tabletToggleBtnTarget
        if (this.tabletMode) {
            btn.classList.replace('btn-outline-primary', 'btn-primary')
        } else {
            btn.classList.replace('btn-primary', 'btn-outline-primary')
        }
        this.renderTable()
    }

    openTabletFor(event) {
        const index = parseInt(event.currentTarget.dataset.index)
        this.tabletCurrentIndex = index
        this._renderTabletStudent()
        this.tabletOverlayTarget.style.display = 'flex'
        document.body.style.overflow = 'hidden'
    }

    closeTablet() {
        this.tabletOverlayTarget.style.display = 'none'
        document.body.style.overflow = ''
    }

    tabletNext() {
        this.tabletCurrentIndex = (this.tabletCurrentIndex + 1) % this.elevesValue.length
        this._renderTabletStudent()
    }

    tabletPrev() {
        this.tabletCurrentIndex = (this.tabletCurrentIndex - 1 + this.elevesValue.length) % this.elevesValue.length
        this._renderTabletStudent()
    }

    tabletIncrement(event) {
        const col = parseInt(event.currentTarget.dataset.col)
        const eleve = this.elevesValue[this.tabletCurrentIndex]
        this.counts[eleve.id][col] = (this.counts[eleve.id][col] || 0) + 1
        this._updateTabletCount(eleve.id, col)
        this.updateCell(eleve.id, col)
    }

    tabletDecrement(event) {
        const col = parseInt(event.currentTarget.dataset.col)
        const eleve = this.elevesValue[this.tabletCurrentIndex]
        this.counts[eleve.id][col] = Math.max(0, (this.counts[eleve.id][col] || 0) - 1)
        this._updateTabletCount(eleve.id, col)
        this.updateCell(eleve.id, col)
    }

    _renderTabletStudent() {
        const eleve = this.elevesValue[this.tabletCurrentIndex]
        const counts = this.counts[eleve.id]
        const n = this.tabletCurrentIndex + 1
        const total_students = this.elevesValue.length

        const badge = eleve.sexe === 'M'
            ? '<span class="badge bg-info bg-opacity-25 text-info border ms-1">M</span>'
            : eleve.sexe === 'F'
            ? '<span class="badge bg-danger bg-opacity-25 text-danger border ms-1">F</span>'
            : ''
        this.tabletStudentNameTarget.innerHTML = `${this.escapeHtml(eleve.fullName)} ${badge}`
        this.tabletStudentCounterTarget.textContent = `${n} / ${total_students}`

        this.tabletActionButtonsTarget.innerHTML = this.actionLabels.map((label, j) => `
            <div class="mb-4">
                <div class="fw-semibold mb-3 text-center text-uppercase"
                     style="color:#94a3b8;letter-spacing:.08em;font-size:.8rem">
                    ${this.escapeHtml(label)}
                </div>
                <div class="d-flex align-items-center justify-content-center gap-4">
                    <button class="btn btn-outline-light rounded-circle"
                            style="width:80px;height:80px;font-size:2.5rem;line-height:1"
                            data-action="actions#tabletDecrement" data-col="${j}">−</button>
                    <div class="fw-bold text-white font-monospace text-center"
                         style="font-size:clamp(3rem,10vw,5rem);min-width:90px;line-height:1"
                         data-tablet-count="${j}">${counts[j] || 0}</div>
                    <button class="btn btn-primary rounded-circle"
                            style="width:80px;height:80px;font-size:2.5rem;line-height:1"
                            data-action="actions#tabletIncrement" data-col="${j}">+</button>
                </div>
            </div>
        `).join('')

        const total = counts.reduce((a, b) => a + b, 0)
        this.tabletTotalTarget.textContent = total
    }

    _updateTabletCount(eleveId, col) {
        const el = this.tabletActionButtonsTarget.querySelector(`[data-tablet-count="${col}"]`)
        if (el) el.textContent = this.counts[eleveId][col]
        const total = this.counts[eleveId].reduce((a, b) => a + b, 0)
        this.tabletTotalTarget.textContent = total
    }

    // ── Labels / action types ──────────────────────────────────────────

    renameLabel(event) {
        const col = parseInt(event.currentTarget.dataset.col)
        this.actionLabels[col] = event.currentTarget.value
        const headers = this.tableHeadTarget.querySelectorAll('th')
        if (headers[col + 1]) headers[col + 1].textContent = event.currentTarget.value
    }

    addActionType() {
        this.actionLabels.push(`Action ${this.actionLabels.length + 1}`)
        this.elevesValue.forEach(e => { this.counts[e.id].push(0) })
        this.render()
    }

    removeActionType(event) {
        const col = parseInt(event.currentTarget.dataset.col)
        this.actionLabels.splice(col, 1)
        this.elevesValue.forEach(e => { this.counts[e.id].splice(col, 1) })
        this.render()
    }

    // ── Reset / export ─────────────────────────────────────────────────

    async saveResults() {
        const label = await showSaveDialog()
        if (label === null) return

        const hasData = this.elevesValue.some(e => this.counts[e.id]?.some(c => c > 0))
        if (!hasData) {
            await showAlert('Aucun compteur n\'a été incrémenté.', { type: 'info', title: 'Résultats vides' })
            return
        }

        const resultats = this.elevesValue.map(e => ({
            eleveId: e.id, fullName: e.fullName, sexe: e.sexe,
            counts: this.counts[e.id] || this.actionLabels.map(() => 0),
            total: (this.counts[e.id] || []).reduce((a, b) => a + b, 0),
        }))

        await this._postSave(label, { labels: this.actionLabels, resultats })
    }

    async _postSave(label, data) {
        const btn = this.saveBtnTarget
        btn.disabled = true
        try {
            const res = await fetch('/api/resultats', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ outil: 'actions', classeId: this.classeIdValue, label: label || null, data }),
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

    async resetAll() {
        if (!await showConfirm('Remettre tous les compteurs à zéro ?', { title: 'Réinitialisation', confirmLabel: 'Réinitialiser' })) return
        this.elevesValue.forEach(e => { this.counts[e.id] = this.actionLabels.map(() => 0) })
        this.renderTable()
    }

    exportResults() {
        let text = ['Élève', ...this.actionLabels, 'Total'].join('\t') + '\n'
        this.elevesValue.forEach(eleve => {
            const counts = this.counts[eleve.id]
            const total = counts.reduce((a, b) => a + b, 0)
            text += [eleve.fullName, ...counts, total].join('\t') + '\n'
        })
        this.exportTextTarget.value = text
        this.exportAreaTarget.classList.remove('d-none')
        navigator.clipboard?.writeText(text).catch(() => {})
    }

    escapeHtml(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    }
}
