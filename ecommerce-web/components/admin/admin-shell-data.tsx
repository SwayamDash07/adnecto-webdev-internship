'use client'

import { createContext, useContext } from 'react'
import type { AdminProfile } from '@/lib/admin-auth'
import type { AdminNotification } from './admin-notifications-bell'

export type AdminShellData = {
  profile: AdminProfile
  openComplaints: number
  openRefunds: number
  unreadMessages: number
  notifications: AdminNotification[]
  unreadNotifications: number
}

const AdminShellDataContext = createContext<AdminShellData | null>(null)

export function AdminShellDataProvider({ data, children }: { data: AdminShellData; children: React.ReactNode }) {
  return <AdminShellDataContext.Provider value={data}>{children}</AdminShellDataContext.Provider>
}

export function useAdminShellData() {
  return useContext(AdminShellDataContext)
}
