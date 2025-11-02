'use client'

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { RoleGuard } from './RoleGuard'
import { UserRole } from '@prisma/client'

interface TeamMember {
  id: string
  name: string | null
  email: string
  role: UserRole
  isActive: boolean
  lastActiveAt: Date | null
  createdAt: Date
}

interface Team {
  id: string
  name: string
  settings?: Record<string, unknown>
  users?: TeamMember[]
}

export function TeamManagement() {
  const { user, token } = useAuth()
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteData, setInviteData] = useState({
    email: '',
    name: '',
    role: UserRole.EDITOR as UserRole,
  })

  useEffect(() => {
    if (user && token) {
      fetchTeamData()
      fetchTeamMembers()
    }
  }, [user, token]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchTeamData = async () => {
    try {
      const response = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setTeam(data.team)
      } else {
        setError('Failed to fetch team data')
      }
    } catch (error) {
      console.error('Fetch team error:', error)
      setError('Network error')
    }
  }

  const fetchTeamMembers = async () => {
    try {
      const response = await fetch('/api/teams/members', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setMembers(data.members)
      } else {
        setError('Failed to fetch team members')
      }
    } catch (error) {
      console.error('Fetch members error:', error)
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const response = await fetch('/api/teams/members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(inviteData),
      })

      const data = await response.json()

      if (data.success) {
        setMembers(prev => [...prev, data.user])
        setShowInviteForm(false)
        setInviteData({ email: '', name: '', role: UserRole.EDITOR })
      } else {
        setError(data.error || 'Failed to invite user')
      }
    } catch (error) {
      console.error('Invite error:', error)
      setError('Network error')
    }
  }

  const handleUpdateMember = async (userId: string, updates: { role?: UserRole; isActive?: boolean }) => {
    try {
      const response = await fetch('/api/teams/members', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, ...updates }),
      })

      const data = await response.json()

      if (data.success) {
        setMembers(prev => 
          prev.map(member => 
            member.id === userId ? { ...member, ...updates } : member
          )
        )
      } else {
        setError(data.error || 'Failed to update member')
      }
    } catch (error) {
      console.error('Update member error:', error)
      setError('Network error')
    }
  }

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return 'bg-red-100 text-red-800'
      case UserRole.EDITOR:
        return 'bg-blue-100 text-blue-800'
      case UserRole.VIEWER:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!user) return null

  if (isLoading) {
    return (
      <div className="bg-white shadow-lg rounded-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Team Management</h2>
        <RoleGuard allowedRoles={[UserRole.ADMIN]}>
          <button
            onClick={() => setShowInviteForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Invite Member
          </button>
        </RoleGuard>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {team && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">{team.name}</h3>
          <p className="text-gray-600">Team ID: {team.id}</p>
        </div>
      )}

      {showInviteForm && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Invite New Member</h3>
          <form onSubmit={handleInviteSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={inviteData.name}
                  onChange={(e) => setInviteData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role
              </label>
              <select
                value={inviteData.role}
                onChange={(e) => setInviteData(prev => ({ ...prev, role: e.target.value as UserRole }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={UserRole.VIEWER}>Viewer</option>
                <option value={UserRole.EDITOR}>Editor</option>
                <option value={UserRole.ADMIN}>Admin</option>
              </select>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Send Invite
              </button>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Team Members ({members.length})</h3>
        <div className="space-y-3">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-600">
                    {member.name?.charAt(0).toUpperCase() || member.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{member.name || 'Unnamed User'}</p>
                  <p className="text-sm text-gray-600">{member.email}</p>
                  {member.lastActiveAt && (
                    <p className="text-xs text-gray-500">
                      Last active: {new Date(member.lastActiveAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleBadgeColor(member.role)}`}>
                  {member.role}
                </span>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  member.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {member.isActive ? 'Active' : 'Inactive'}
                </span>
                <RoleGuard allowedRoles={[UserRole.ADMIN]}>
                  {member.id !== user.id && (
                    <div className="flex space-x-2">
                      <select
                        value={member.role}
                        onChange={(e) => handleUpdateMember(member.id, { role: e.target.value as UserRole })}
                        className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value={UserRole.VIEWER}>Viewer</option>
                        <option value={UserRole.EDITOR}>Editor</option>
                        <option value={UserRole.ADMIN}>Admin</option>
                      </select>
                      <button
                        onClick={() => handleUpdateMember(member.id, { isActive: !member.isActive })}
                        className={`text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 ${
                          member.isActive 
                            ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500' 
                            : 'bg-green-100 text-green-700 hover:bg-green-200 focus:ring-green-500'
                        }`}
                      >
                        {member.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  )}
                </RoleGuard>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}