.level-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.level-tab {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
}

.level-tab.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.admin-course-block {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 16px;
}

.admin-course-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.admin-course-head h3 {
  margin: 0;
  font-size: 16px;
}

.admin-row-actions {
  display: flex;
  gap: 6px;
}

.icon-btn {
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-muted);
  font-size: 12px;
  padding: 4px 8px;
  cursor: pointer;
}

.icon-btn:hover {
  color: var(--color-text);
}

.admin-module-block {
  margin-top: 12px;
  padding: 10px 12px;
  background: var(--color-surface-alt);
  border-radius: var(--radius);
}

.admin-module-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
}

.admin-lesson-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  font-size: 13px;
  border-top: 1px solid var(--color-border);
}

.admin-lesson-row:first-of-type {
  border-top: none;
  margin-top: 6px;
}

.add-link {
  font-size: 12px;
  color: var(--color-primary);
  cursor: pointer;
  background: none;
  border: none;
  padding: 4px 0;
}

.modal textarea,
.modal input[type="text"],
.modal input[type="number"] {
  width: 100%;
  padding: 10px 12px;
  background: var(--color-surface-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  color: var(--color-text);
  font-family: var(--font-base);
  font-size: 14px;
  margin-top: 4px;
}

.modal label {
  font-size: 13px;
  color: var(--color-text-muted);
  display: block;
  margin-top: 12px;
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  padding: var(--space-md);
}

.modal {
  width: 100%;
  max-width: 400px;
}

.stat-table {
  width: 100%;
  border-collapse: collapse;
}

.stat-table th,
.stat-table td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--color-border);
  font-size: 14px;
}

.stat-table th {
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: 12px;
  text-transform: uppercase;
}
