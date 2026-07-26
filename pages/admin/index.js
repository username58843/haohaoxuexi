import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { Container, Table, Button, Card, CardBody, Badge, Modal, ModalHeader, ModalBody, Form, FormGroup, Label, Input, Alert } from 'reactstrap'
import axios from 'axios'
import { useAuth } from '~/lib/contexts/AuthContext'
import { useSettings } from '~/lib/contexts/SettingsContext'
import SiteLayout from '~/components/SiteLayout'
import SubpageHeader from '~/components/SubpageHeader'

export default function AdminPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { t } = useSettings()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [formData, setFormData] = useState({
    isPremium: false,
    premiumExpiresAt: '',
    isAdmin: false,
    isBanned: false,
    banReason: ''
  })
  const [onlineUsers, setOnlineUsers] = useState([])
  const [showOnlineOnly, setShowOnlineOnly] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.replace('/auth')
      return
    }

    if (!user.isAdmin) {
      router.replace('/')
      return
    }

    loadUsers()
  }, [user, authLoading, router])

  const loadUsers = async () => {
    try {
      const response = await axios.get('/api/admin/users', {
        withCredentials: true
      })
      const allUsers = response.data.users || []
      setUsers(allUsers)

      // Определяем онлайн пользователей (активных в последние 5 минут)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      const online = allUsers.filter(u => u.lastSeen && new Date(u.lastSeen) > fiveMinutesAgo)
      setOnlineUsers(online)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (userData) => {
    setSelectedUser(userData)
    setFormData({
      isPremium: userData.isPremium || false,
      premiumExpiresAt: userData.premiumExpiresAt ? new Date(userData.premiumExpiresAt).toISOString().split('T')[0] : '',
      isAdmin: userData.isAdmin || false,
      isBanned: userData.isBanned || false,
      banReason: userData.banReason || ''
    })
    setModalOpen(true)
  }

  const handleUpdateUser = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    try {
      await axios.put(`/api/admin/users/${selectedUser.id}`, formData, {
        withCredentials: true
      })

      setSuccess(t('userUpdated'))
      setModalOpen(false)
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.error || t('failedUpdateUser'))
    }
  }

  const handleDeleteUser = async (userId) => {
    if (!confirm(t('confirmDeleteUser'))) return

    try {
      await axios.delete(`/api/admin/users/${userId}`, {
        withCredentials: true
      })
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.error || t('failedDeleteUser'))
    }
  }

  const handleBanUser = async (userId, banReason) => {
    const reason = banReason || prompt('Enter ban reason:')
    if (!reason) return

    try {
      await axios.put(`/api/admin/users/${userId}`, {
        isBanned: true,
        banReason: reason
      }, {
        withCredentials: true
      })
      setSuccess(t('userBanned'))
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.error || t('failedBanUser'))
    }
  }

  const handleUnbanUser = async (userId) => {
    try {
      await axios.put(`/api/admin/users/${userId}`, {
        isBanned: false,
        banReason: null
      }, {
        withCredentials: true
      })
      setSuccess(t('userUnbanned'))
      loadUsers()
    } catch (err) {
      setError(err.response?.data?.error || t('failedUnbanUser'))
    }
  }

  if (!user || !user.isAdmin) {
    return <SiteLayout><div>Access denied</div></SiteLayout>
  }

  if (loading) {
    return <SiteLayout><div>{t('loadingText')}</div></SiteLayout>
  }

  return (
    <SiteLayout>
      <Container className="px-0">
        <SubpageHeader title={t('adminPanel') || 'Admin Panel'} />

        {success && <Alert color="success">{success}</Alert>}
        {error && <Alert color="danger">{error}</Alert>}

        <Card className="mb-4 glass">
          <CardBody>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h4>Users Management</h4>
              <Button
                color="info"
                size="sm"
                onClick={() => setShowOnlineOnly(!showOnlineOnly)}
              >
                {showOnlineOnly ? 'Show All Users' : `Online Now: ${onlineUsers.length}`}
              </Button>
            </div>
            <Table dark>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Premium</th>
                  <th>Admin</th>
                  <th>IP Address</th>
                  <th>Last Seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(showOnlineOnly ? onlineUsers : users).map((u) => {
                  const isOnline = onlineUsers.some(ou => ou.id === u.id)
                  return (
                    <tr key={u.id}>
                      <td>{u.id.substring(0, 8)}...</td>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        {u.isBanned ? (
                          <Badge color="danger">{t('statusBanned')}</Badge>
                        ) : isOnline ? (
                          <Badge color="success">Online</Badge>
                        ) : (
                          <Badge color="secondary">
                            Offline: {u.lastSeen ? new Date(u.lastSeen).toLocaleString() : 'Never'}
                          </Badge>
                        )}
                      </td>
                      <td>
                        {u.isPremium ? (
                          <Badge color="success">Yes</Badge>
                        ) : (
                          <Badge color="secondary">No</Badge>
                        )}
                      </td>
                      <td>
                        {u.isAdmin ? (
                          <Badge color="danger">Yes</Badge>
                        ) : (
                          <Badge color="secondary">No</Badge>
                        )}
                      </td>
                      <td>
                        <code style={{ fontSize: '0.8rem' }}>{u.ipAddress || t('unknown')}</code>
                      </td>
                      <td>{u.lastSeen ? new Date(u.lastSeen).toLocaleString() : 'Never'}</td>
                      <td>
                        <Button
                          size="sm"
                          color="primary"
                          className="me-1 mb-1"
                          onClick={() => openEditModal(u)}
                        >
                          {t('btnEdit')}
                        </Button>
                        {u.id !== user.id && (
                          <>
                            {u.isBanned ? (
                              <Button
                                size="sm"
                                color="warning"
                                className="me-1 mb-1"
                                onClick={() => handleUnbanUser(u.id)}
                              >
                                {t('btnUnban')}
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                color="danger"
                                className="me-1 mb-1"
                                onClick={() => handleBanUser(u.id, u.banReason)}
                              >
                                {t('btnBan')}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              color="danger"
                              className="mb-1"
                              onClick={() => handleDeleteUser(u.id)}
                            >
                              {t('btnDelete')}
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
          </CardBody>
        </Card>

        <Modal isOpen={modalOpen} toggle={() => setModalOpen(false)} style={{ backgroundColor: '#1c1c1e', color: '#fff' }}>
          <ModalHeader toggle={() => setModalOpen(false)} style={{ backgroundColor: '#1c1c1e', color: '#fff', borderBottom: '1px solid #444' }}>
            {t('modalEditUser')}: {selectedUser?.name}
          </ModalHeader>
          <ModalBody style={{ backgroundColor: '#1c1c1e', color: '#fff' }}>
            {selectedUser && (
              <div className="mb-3">
                <strong>User Info:</strong><br />
                <small>ID: {selectedUser.id}</small><br />
                <small>Email: {selectedUser.email}</small><br />
                <small>IP: {selectedUser.ipAddress || 'Unknown'}</small><br />
                <small>Last Seen: {selectedUser.lastSeen ? new Date(selectedUser.lastSeen).toLocaleString() : 'Never'}</small>
                {selectedUser.banReason && (
                  <><br /><small className="text-danger">Ban Reason: {selectedUser.banReason}</small></>
                )}
              </div>
            )}
            <Form onSubmit={handleUpdateUser}>
              <FormGroup check>
                <Label check>
                  <Input
                    type="checkbox"
                    checked={formData.isPremium}
                    onChange={(e) => setFormData({ ...formData, isPremium: e.target.checked })}
                  />
                  {' '}Premium User
                </Label>
              </FormGroup>
              {formData.isPremium && (
                <FormGroup>
                  <Label>Premium Expires At</Label>
                  <Input
                    type="date"
                    value={formData.premiumExpiresAt}
                    onChange={(e) => setFormData({ ...formData, premiumExpiresAt: e.target.value })}
                    style={{ backgroundColor: '#2c2c2e', color: '#fff', borderColor: '#444' }}
                  />
                </FormGroup>
              )}
              <FormGroup check>
                <Label check>
                  <Input
                    type="checkbox"
                    checked={formData.isAdmin}
                    onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                  />
                  {' '}Admin User
                </Label>
              </FormGroup>
              <FormGroup check>
                <Label check>
                  <Input
                    type="checkbox"
                    checked={formData.isBanned}
                    onChange={(e) => setFormData({ ...formData, isBanned: e.target.checked })}
                  />
                  {' '}{t('bannedUser')}
                </Label>
              </FormGroup>
              {formData.isBanned && (
                <FormGroup>
                  <Label>{t('banReason')}</Label>
                  <Input
                    type="text"
                    value={formData.banReason}
                    onChange={(e) => setFormData({ ...formData, banReason: e.target.value })}
                    placeholder={t('placeholderBanReason')}
                    style={{ backgroundColor: '#2c2c2e', color: '#fff', borderColor: '#444' }}
                  />
                </FormGroup>
              )}
              <Button type="submit" color="primary">Update User</Button>
            </Form>
          </ModalBody>
        </Modal>
      </Container>
    </SiteLayout>
  )
}

