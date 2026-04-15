import * as todoService from "../services/todo.service.js";

export async function getAll(req, res) {
  try {
    const todos = await todoService.getTodos(req.user.uid);
    res.json(todos);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch todos.", error: err.message });
  }
}

export async function create(req, res) {
  const { text } = req.body;

  if (!text || typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ message: "text is required and must be a non-empty string." });
  }

  try {
    const todo = await todoService.createTodo(req.user.uid, text.trim());
    res.status(201).json(todo);
  } catch (err) {
    res.status(500).json({ message: "Failed to create todo.", error: err.message });
  }
}

export async function update(req, res) {
  const { id } = req.params;
  const { text, completed } = req.body;

  const fields = {};
  if (text !== undefined) {
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ message: "text must be a non-empty string." });
    }
    fields.text = text.trim();
  }
  if (completed !== undefined) {
    if (typeof completed !== "boolean") {
      return res.status(400).json({ message: "completed must be a boolean." });
    }
    fields.completed = completed;
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ message: "No updatable fields provided." });
  }

  try {
    const todo = await todoService.updateTodo(id, req.user.uid, fields);
    if (!todo) return res.status(404).json({ message: "Todo not found." });
    res.json(todo);
  } catch (err) {
    res.status(500).json({ message: "Failed to update todo.", error: err.message });
  }
}

export async function remove(req, res) {
  const { id } = req.params;

  try {
    const deleted = await todoService.deleteTodo(id, req.user.uid);
    if (!deleted) return res.status(404).json({ message: "Todo not found." });
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Failed to delete todo.", error: err.message });
  }
}

export async function clearCompleted(req, res) {
  try {
    const count = await todoService.deleteCompletedTodos(req.user.uid);
    res.json({ deletedCount: count });
  } catch (err) {
    res.status(500).json({ message: "Failed to clear completed todos.", error: err.message });
  }
}
