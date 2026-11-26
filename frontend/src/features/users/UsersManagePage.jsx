import { useEffect, useState } from 'react'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { useTranslation } from '../../utils/i18n'
import { ROLE_LABELS } from '../../utils/roles'

export function UsersManagePage() {
  const { user } = useAuth()
  const { t } = useTranslation()
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadUsers() {
    setLoading(true)
    try {
      const { data } = await api.get('/users', { params: search ? { search } : undefined })
      setUsers(data)
      setError('')
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function updateRole(account, role) {
    try {
      await api.patch(`/users/${account.id}`, { role })
      await loadUsers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to update role.')
    }
  }

  async function toggleActive(account) {
    try {
      await api.patch(`/users/${account.id}`, { is_active: !account.is_active })
      await loadUsers()
    } catch (err) {
      setError(err.response?.data?.detail || 'Unable to update account.')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
          placeholder={t('Search users')}
          className="rounded-lg border border-palm-leaf/50 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={loadUsers}
          className="rounded-lg bg-hunter-green px-4 py-2 text-sm font-semibold text-cornsilk"
        >
          {t('Search')}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {t(error)}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-hunter-green">{t('Loading users...')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-palm-leaf/30 bg-white">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-evergreen/5 text-evergreen">
              <tr>
                <th className="px-4 py-3">{t('Name')}</th>
                <th className="px-4 py-3">{t('Email / ID')}</th>
                <th className="px-4 py-3">{t('Role')}</th>
                <th className="px-4 py-3">{t('Status')}</th>
                <th className="px-4 py-3">{t('Action')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((account) => (
                <tr key={account.id} className="border-t border-palm-leaf/20">
                  <td className="px-4 py-3 font-semibold">{account.full_name}</td>
                  <td className="px-4 py-3">
                    {account.id_number || account.email}
                    <div className="text-xs text-hunter-green">{account.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={account.role}
                      disabled={account.role === 'super_admin' && user?.role !== 'super_admin'}
                      onChange={(e) => updateRole(account, e.target.value)}
                      className="rounded-lg border border-palm-leaf/50 px-2 py-1"
                    >
                      {Object.entries(ROLE_LABELS).map(([role, label]) => (
                        <option key={role} value={role}>
                          {t(label)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">{t(account.is_active ? 'Active' : 'Inactive')}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(account)}
                      disabled={account.role === 'super_admin' && account.id !== user?.id}
                      className="rounded-lg border border-palm-leaf/50 px-3 py-1.5 text-xs font-semibold hover:bg-evergreen/5 disabled:opacity-50"
                    >
                      {t(account.is_active ? 'Deactivate' : 'Activate')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}