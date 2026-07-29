const STORAGE_KEY = "todo-app:todos";
const CATEGORY_CLASS = { 업무: "work", 개인: "personal", 공부: "study" };

const todoListEl = document.getElementById("todo-list");
const emptyStateEl = document.getElementById("empty-state");
const progressTextEl = document.getElementById("progress-text");
const progressBarFillEl = document.getElementById("progress-bar-fill");
const addFormEl = document.getElementById("add-form");
const newTitleEl = document.getElementById("new-title");
const newCategoryEl = document.getElementById("new-category");

let todos = loadTodos();

function loadTodos() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTodos() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

function addTodo(title, category) {
  todos.push({
    id: crypto.randomUUID(),
    title,
    category,
    completed: false,
    createdAt: new Date().toISOString(),
  });
  saveTodos();
  render();
}

function updateTodoTitle(id, newTitle) {
  const trimmed = newTitle.trim();
  const todo = todos.find((t) => t.id === id);
  if (todo && trimmed) {
    todo.title = trimmed;
    saveTodos();
  }
  render();
}

function toggleComplete(id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;
  todo.completed = !todo.completed;
  saveTodos();
  render();
}

function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  saveTodos();
  render();
}

function renderProgress() {
  const total = todos.length;
  const completed = todos.filter((t) => t.completed).length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  progressTextEl.textContent = `완료 ${completed} / 전체 ${total} · ${percent}%`;
  progressBarFillEl.style.width = `${percent}%`;
}

function createTodoElement(todo) {
  const li = document.createElement("li");
  li.className = "todo-item" + (todo.completed ? " completed" : "");
  li.dataset.id = todo.id;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "todo-checkbox";
  checkbox.checked = todo.completed;
  checkbox.setAttribute("aria-label", `${todo.title} 완료 체크`);

  const titleSpan = document.createElement("span");
  titleSpan.className = "todo-title";
  titleSpan.textContent = todo.title;
  titleSpan.tabIndex = 0;
  titleSpan.setAttribute("role", "button");
  titleSpan.setAttribute("aria-label", `${todo.title} 수정`);

  const badge = document.createElement("span");
  const categoryClass = CATEGORY_CLASS[todo.category] ?? "personal";
  badge.className = `badge badge-${categoryClass}`;
  badge.textContent = todo.category;

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "삭제";
  deleteBtn.setAttribute("aria-label", `${todo.title} 삭제`);

  li.append(checkbox, titleSpan, badge, deleteBtn);
  return li;
}

function render() {
  todoListEl.innerHTML = "";
  for (const todo of todos) {
    todoListEl.appendChild(createTodoElement(todo));
  }
  emptyStateEl.hidden = todos.length > 0;
  renderProgress();
}

function startEditing(titleSpan, id) {
  const todo = todos.find((t) => t.id === id);
  if (!todo) return;

  const input = document.createElement("input");
  input.type = "text";
  input.className = "todo-edit-input";
  input.value = todo.title;
  titleSpan.replaceWith(input);
  input.focus();
  input.select();

  let isCommitted = false;

  function commit() {
    if (isCommitted) return;
    isCommitted = true;
    updateTodoTitle(id, input.value);
  }

  function cancel() {
    isCommitted = true;
    render();
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") cancel();
  });
  input.addEventListener("blur", commit);
}

addFormEl.addEventListener("submit", (e) => {
  e.preventDefault();
  const title = newTitleEl.value.trim();
  if (!title) return;
  addTodo(title, newCategoryEl.value);
  newTitleEl.value = "";
  newTitleEl.focus();
});

todoListEl.addEventListener("change", (e) => {
  if (e.target.classList.contains("todo-checkbox")) {
    toggleComplete(e.target.closest(".todo-item").dataset.id);
  }
});

todoListEl.addEventListener("click", (e) => {
  const li = e.target.closest(".todo-item");
  if (!li) return;
  const id = li.dataset.id;

  if (e.target.classList.contains("delete-btn")) {
    const todo = todos.find((t) => t.id === id);
    if (todo && confirm(`"${todo.title}"을(를) 삭제할까요?`)) {
      deleteTodo(id);
    }
  } else if (e.target.classList.contains("todo-title")) {
    startEditing(e.target, id);
  }
});

todoListEl.addEventListener("keydown", (e) => {
  if (e.target.classList.contains("todo-title") && e.key === "Enter") {
    e.preventDefault();
    startEditing(e.target, e.target.closest(".todo-item").dataset.id);
  }
});

render();
