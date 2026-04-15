import { Controller } from '@hotwired/stimulus'
import { showAlert, showConfirm } from '../utils/dialog.js'

export default class extends Controller {
    async delete(event) {
        const btn = event.currentTarget
        const id  = btn.dataset.id

        const confirmed = await showConfirm('Supprimer définitivement ce résultat ?', {
            title        : 'Supprimer le résultat',
            confirmLabel : 'Supprimer',
            confirmClass : 'btn-danger',
        })
        if (!confirmed) return

        btn.disabled = true
        try {
            const res = await fetch('/api/resultats/' + id, { method: 'DELETE', credentials: 'same-origin' })
            if (res.ok) {
                btn.closest('.accordion-item').remove()
            } else {
                throw new Error()
            }
        } catch {
            btn.disabled = false
            await showAlert('Impossible de supprimer ce résultat.', { type: 'error', title: 'Erreur' })
        }
    }
}
