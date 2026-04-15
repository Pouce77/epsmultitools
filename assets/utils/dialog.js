/**
 * Boîtes de dialogue accessibles basées sur <dialog> natif.
 *
 * showSaveDialog() → Promise<string|null>  (null = annulé, '' = sans label)
 * Usage :
 *   import { showAlert, showConfirm } from '../utils/dialog'
 *   await showAlert('Message')
 *   if (!await showConfirm('Continuer ?')) return
 */

let _dialog = null

const ICONS = {
    warning : 'bi bi-exclamation-triangle-fill text-warning',
    error   : 'bi bi-x-circle-fill text-danger',
    info    : 'bi bi-info-circle-fill text-primary',
    success : 'bi bi-check-circle-fill text-success',
}

function getDialog() {
    if (_dialog) return _dialog
    _dialog = document.createElement('dialog')
    _dialog.className = 'app-dialog'
    _dialog.innerHTML = `
        <div class="app-dialog-inner">
            <div class="app-dialog-header">
                <i id="dlg-icon"></i>
                <strong id="dlg-title"></strong>
            </div>
            <p id="dlg-msg"></p>
            <div id="dlg-btns" class="app-dialog-footer"></div>
        </div>
    `
    // Empêche la fermeture par Échap (géré manuellement)
    _dialog.addEventListener('cancel', e => e.preventDefault())
    document.body.appendChild(_dialog)
    return _dialog
}

/**
 * Affiche un message d'information.
 * @param {string} message
 * @param {{ title?: string, type?: 'warning'|'error'|'info'|'success' }} options
 * @returns {Promise<void>}
 */
export function showAlert(message, { title = 'Attention', type = 'warning' } = {}) {
    return new Promise(resolve => {
        const d = getDialog()
        d.querySelector('#dlg-icon').className = ICONS[type] ?? ICONS.warning
        d.querySelector('#dlg-title').textContent = title
        d.querySelector('#dlg-msg').textContent = message

        const btns = d.querySelector('#dlg-btns')
        btns.innerHTML = '<button class="btn btn-primary btn-sm px-4" autofocus>OK</button>'
        btns.querySelector('button').onclick = () => { d.close(); resolve() }

        d.showModal()
    })
}

/**
 * Dialogue de sauvegarde avec champ label optionnel.
 * @returns {Promise<string|null>} label saisi, '' si vide, null si annulé
 */
export function showSaveDialog() {
    return new Promise(resolve => {
        const d = getDialog()
        d.querySelector('#dlg-icon').className = ICONS.success
        d.querySelector('#dlg-title').textContent = 'Sauvegarder les résultats'
        d.querySelector('#dlg-msg').innerHTML =
            '<input type="text" id="dlg-save-label" class="form-control form-control-sm" ' +
            'placeholder="Label optionnel (ex : Évaluation 1, Match retour…)" maxlength="200">'

        const btns = d.querySelector('#dlg-btns')
        btns.innerHTML = `
            <button id="dlg-cancel" class="btn btn-outline-secondary btn-sm">Annuler</button>
            <button id="dlg-confirm" class="btn btn-success btn-sm px-3">
                <i class="bi bi-cloud-upload-fill me-1"></i>Sauvegarder
            </button>
        `

        const input = d.querySelector('#dlg-save-label')
        const close = (val) => { d.close(); resolve(val) }

        btns.querySelector('#dlg-cancel').onclick  = () => close(null)
        btns.querySelector('#dlg-confirm').onclick = () => close(input.value.trim())
        input.addEventListener('keydown', e => { if (e.key === 'Enter') close(input.value.trim()) })

        d.showModal()
        input.focus()
    })
}

/**
 * Demande une confirmation.
 * @param {string} message
 * @param {{ title?: string, confirmLabel?: string, confirmClass?: string, cancelLabel?: string }} options
 * @returns {Promise<boolean>}
 */
export function showConfirm(message, {
    title        = 'Confirmation',
    confirmLabel = 'Confirmer',
    confirmClass = 'btn-danger',
    cancelLabel  = 'Annuler',
} = {}) {
    return new Promise(resolve => {
        const d = getDialog()
        d.querySelector('#dlg-icon').className = ICONS.warning
        d.querySelector('#dlg-title').textContent = title
        d.querySelector('#dlg-msg').textContent = message

        const btns = d.querySelector('#dlg-btns')
        btns.innerHTML = `
            <button id="dlg-cancel" class="btn btn-outline-secondary btn-sm" autofocus>${cancelLabel}</button>
            <button id="dlg-confirm" class="btn ${confirmClass} btn-sm px-3">${confirmLabel}</button>
        `
        btns.querySelector('#dlg-cancel').onclick  = () => { d.close(); resolve(false) }
        btns.querySelector('#dlg-confirm').onclick = () => { d.close(); resolve(true) }

        d.showModal()
    })
}
