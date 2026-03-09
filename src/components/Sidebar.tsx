import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Maximize, Settings } from 'lucide-react';
import './Sidebar.css';

const Sidebar: React.FC = () => {
    return (
        <aside className="sidebar glass-panel">
            <div className="sidebar-header">
                <h1 className="sidebar-brand">
                    <span className="brand-icon"></span>
                    NameCade
                </h1>
            </div>

            <nav className="sidebar-nav">
                <NavLink
                    to="/dashboard"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <LayoutDashboard size={20} />
                    <span>Dashboard</span>
                </NavLink>

                <NavLink
                    to="/scanner"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <Maximize size={20} />
                    <span>Scan Card</span>
                </NavLink>
            </nav>

            <div className="sidebar-footer">
                <button className="nav-item">
                    <Settings size={20} />
                    <span>Settings</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
