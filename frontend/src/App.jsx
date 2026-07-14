import { useEffect, useState } from "react";

// nginx proxies /api/* to the backend service in production;
// vite.config.js proxies the same path during local dev.
const API_BASE = "/api";

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadTasks() {
    try {
      setError(null);
      const res = await fetch(`${API_BASE}/tasks`);
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      setTasks(await res.json());
    } catch (err) {
      setError("Couldn't reach the backend. Is it running?");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  async function addTask(e) {
    e.preventDefault();
    if (!title.trim()) return;
    await fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    setTitle("");
    setDescription("");
    loadTasks();
  }

  async function toggleComplete(task) {
    await fetch(`${API_BASE}/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    loadTasks();
  }

  async function deleteTask(id) {
    await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
    loadTasks();
  }

  return (
    <div className="page">
      <header>
        <h1>Task tracker</h1>
        <p className="subtitle">3-tier platform demo &mdash; React &rarr; FastAPI &rarr; Postgres</p>
      </header>

      <form onSubmit={addTask} className="add-form">
        <input
          type="text"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="text"
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <button type="submit">Add task</button>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading tasks&hellip;</p>}

      {!loading && !error && tasks.length === 0 && (
        <p className="muted">No tasks yet &mdash; add one above.</p>
      )}

      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id} className={task.completed ? "done" : ""}>
            <label>
              <input
                type="checkbox"
                checked={task.completed}
                onChange={() => toggleComplete(task)}
              />
              <div>
                <p className="title">{task.title}</p>
                {task.description && <p className="desc">{task.description}</p>}
              </div>
            </label>
            <button className="delete" onClick={() => deleteTask(task.id)} aria-label="Delete task">
              &times;
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
