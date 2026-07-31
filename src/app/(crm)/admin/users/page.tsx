import UserManagementClient from '@/components/admin/UserManagementClient'

export default function AdminUsersPage() {
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-dark-800">User Management</h1>
        <p className="text-gray-500 text-sm">Create users, set passwords, and manage portal access without opening Supabase.</p>
      </div>
      <UserManagementClient />
    </div>
  )
}
