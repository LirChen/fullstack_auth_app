// client/src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import api from '../context/api';
import { useAuth } from '../context/AuthContext';

function Dashboard() {
  const { user, logout, refreshUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let canceled = false;

    (async () => {
        try {
        if (!user) {
            await refreshUser().catch(() => {});
            if (canceled) return;
        }
        await fetchUsers();
        } catch (err) {
        console.error("Error in useEffect:", err);
        }
    })();

    return () => {
        canceled = true;
    };
    }, []);


  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/api/users/list');
      const list = data?.users;
      setUsers(Array.isArray(list) ? list : []);
      setError('');
    } catch (err) {
      if (err?.response?.status === 401) {
        setError('Session expired. Please login again.');
        window.location.href = '/login';
        return;
      }
      setError('Failed to fetch users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h2>Welcome, {user?.username}!</h2>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        {/* User Profile Section */}
        <div className="profile-section">
          <h3>Your Profile</h3>
          <div className="profile-info">
            <div className="info-item">
              <strong>Username:</strong> {user?.username}
            </div>
            <div className="info-item">
              <strong>Email:</strong> {user?.email}
            </div>
            <div className="info-item">
              <strong>Member Since:</strong> {formatDate(user?.created_at)}
            </div>
            <div className="info-item">
              <strong>Last Login:</strong> {formatDate(user?.last_login)}
            </div>
          </div>
        </div>

        {/* Users List Section */}
        <div className="users-section">
          <h3>All Users ({Array.isArray(users) ? users.length : 0})</h3>

          {error && <div className="error-message">{error}</div>}

          <div className="users-table">
            <table>
                <thead>
                <tr>
                    <th>ID</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Created</th>
                    <th>Last Login</th>
                </tr>
                </thead>
                <tbody>
                {Array.isArray(users) && users.length > 0 ? (
                    users.map((u) => (
                    <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.username}</td>
                        <td>{u.email}</td>
                        <td>{formatDate(u.created_at)}</td>
                        <td>{formatDate(u.last_login)}</td>
                    </tr>
                    ))
                ) : (
                    <tr>
                    <td colSpan="5" style={{ textAlign: "center" }}>
                        No users found
                    </td>
                    </tr>
                )}
                </tbody>
            </table>
          </div>

          <button onClick={fetchUsers} className="refresh-btn">
            Refresh Users
          </button>
        </div>

        {/* System Info Section */}
        <div className="system-section">
          <h3>System Information</h3>
          <div className="system-info">
            <div className="info-item"><strong>Application:</strong> Full-Stack Auth App</div>
            <div className="info-item"><strong>Database:</strong> TiDB with CDC</div>
            <div className="info-item"><strong>Message Queue:</strong> Apache Kafka</div>
            <div className="info-item"><strong>Logging:</strong> log4js (JSON)</div>
            <div className="info-item"><strong>Auth:</strong> JWT</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
