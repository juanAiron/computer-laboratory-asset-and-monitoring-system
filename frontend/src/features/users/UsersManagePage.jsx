import { useEffect, useState } from 'react'
import api from '../../api/client'
import { useAuth } from '../../hooks/useAuth'
import { ROLE_LABELS } from '../../utils/roles'

export function UsersManagePage() {
  const { user } = useAuth()
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
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-evergreen">Users &amp; Roster</h1>
          <p className="text-sm text-hunter-green">Manage accounts and system access.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
            placeholder="Search users"
            className="rounded-lg border border-palm-leaf/50 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={loadUsers}
            className="rounded-lg bg-hunter-green px-4 py-2 text-sm font-semibold text-cornsilk"
          >
            Search
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-hunter-green">Loading users...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-palm-leaf/30 bg-white">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="bg-evergreen/5 text-evergreen">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email / ID</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Action</th>
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
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">{account.is_active ? 'Active' : 'Inactive'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(account)}
                      disabled={account.role === 'super_admin' && account.id !== user?.id}
                      className="rounded-lg border border-palm-leaf/50 px-3 py-1.5 text-xs font-semibold hover:bg-evergreen/5 disabled:opacity-50"
                    >
                      {account.is_active ? 'Deactivate' : 'Activate'}
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