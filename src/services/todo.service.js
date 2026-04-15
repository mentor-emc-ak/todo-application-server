import { Todo } from "../models/Todo.js";

export async function getTodos(userId) {
  return Todo.find({ userId }).sort({ createdAt: -1 });
}

export async function createTodo(userId, text) {
  const todo = new Todo({ userId, text });
  return todo.save();
}

export async function updateTodo(todoId, userId, fields) {
  const todo = await Todo.findOneAndUpdate(
    { _id: todoId, userId },
    { $set: fields },
    { new: true, runValidators: true }
  );

  if (!todo) return null;
  return todo;
}

export async function deleteTodo(todoId, userId) {
  const result = await Todo.findOneAndDelete({ _id: todoId, userId });
  return result !== null;
}

export async function deleteCompletedTodos(userId) {
  const result = await Todo.deleteMany({ userId, completed: true });
  return result.deletedCount;
}
