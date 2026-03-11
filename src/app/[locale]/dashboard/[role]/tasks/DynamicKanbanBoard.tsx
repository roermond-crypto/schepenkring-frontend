"use client";
// Dynamic Kanban Board Component for Admin Tasks
// Dynamic Kanban Board Component for Admin Tasks

import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Plus, Edit2, Trash2, Calendar as CalendarIcon, User as UserIcon, AlertTriangle, Shield, Info, MoreVertical, ChevronDown, ChevronRight, Minimize2, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface Task {
    id: number;
    title: string;
    description?: string;
    priority: "Low" | "Medium" | "High";
    status: string;
    column_id?: number | null;
    position?: number;
    due_date: string;
    type: "assigned" | "personal";
    assigned_to_user?: User;
    created_at: string;
    updated_at: string;
}

interface Column {
    id: number;
    board_id: number;
    name: string;
    position: number;
}

interface Props {
    columns: Column[];
    tasks: Task[];
    onTaskMove: (taskId: number, newColId: number, newPosition: number, tasksMap: Record<number, Task[]>) => void;
    onColumnMove: (colId: number, newPosition: number, cols: Column[]) => void;
    onAddColumn: (name: string) => void;
    onRenameColumn: (id: number, name: string) => void;
    onDeleteColumn: (id: number) => void;
    onAddTask: (columnId: number) => void;
    onEditTask: (task: Task) => void;
    onDeleteTask: (id: number) => void;
}

const DynamicKanbanBoard: React.FC<Props> = ({
    columns,
    tasks,
    onTaskMove,
    onColumnMove,
    onAddColumn,
    onRenameColumn,
    onDeleteColumn,
    onAddTask,
    onEditTask,
    onDeleteTask,
}) => {
    const [cols, setCols] = useState<Column[]>([]);
    const [tasksByCol, setTasksByCol] = useState<Record<number, Task[]>>({});
    const [editingColId, setEditingColId] = useState<number | null>(null);
    const [editingColName, setEditingColName] = useState("");
    const [newColName, setNewColName] = useState("");
    const [isAddingCol, setIsAddingCol] = useState(false);
    const [collapsedCols, setCollapsedCols] = useState<Record<number, boolean>>({});

    const normalizeColumnName = (name: string) => name.trim().toLowerCase();

    const isDoneColumn = (name: string) => {
        const normalized = normalizeColumnName(name);
        return normalized === "done" || normalized === "completed";
    };

    const isInProgressColumn = (name: string) => normalizeColumnName(name) === "in progress";

    const getColumnHeaderStyles = (name: string) => {
        if (isDoneColumn(name)) {
            return {
                title: "text-emerald-700 dark:text-emerald-300",
                count: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
                container: "bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60",
            };
        }

        if (isInProgressColumn(name)) {
            return {
                title: "text-amber-700 dark:text-amber-300",
                count: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
                container: "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/50",
            };
        }

        return {
            title: "text-[#003566] dark:text-sky-300",
            count: "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
            container: "border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/80",
        };
    };

    const getTaskAccentBarClass = (task: Task, columnName: string) => {
        if (task.status === "Done" || isDoneColumn(columnName)) return "bg-emerald-500";
        if (task.priority === "High") return "bg-red-500";
        if (task.priority === "Medium") return "bg-amber-500";
        return "bg-sky-500";
    };

    const toggleCollapse = (colId: number) => {
        setCollapsedCols(prev => ({ ...prev, [colId]: !prev[colId] }));
    };

    useEffect(() => {
        // Sort columns by position
        const sortedCols = [...columns].sort((a, b) => a.position - b.position);
        setCols(sortedCols);

        // Group tasks by column
        const grouped: Record<number, Task[]> = {};
        sortedCols.forEach((c) => {
            grouped[c.id] = [];
        });
        // For tasks that might have no column initially, put them in the first col
        const defaultColId = sortedCols.length > 0 ? sortedCols[0].id : 0;

        tasks.forEach((t) => {
            const colId = t.column_id || defaultColId;
            if (!grouped[colId]) {
                grouped[colId] = [];
            }
            grouped[colId].push(t);
        });

        Object.keys(grouped).forEach((colId) => {
            grouped[Number(colId)].sort((a, b) => (a.position || 0) - (b.position || 0));
        });

        setTasksByCol(grouped);
    }, [columns, tasks]);

    const handleDragEnd = (result: DropResult) => {
        const { source, destination, type } = result;

        if (!destination) return;
        if (source.droppableId === destination.droppableId && source.index === destination.index) return;

        if (type === "column") {
            const newCols = Array.from(cols);
            const [removed] = newCols.splice(source.index, 1);
            newCols.splice(destination.index, 0, removed);

            const updatedCols = newCols.map((c, i) => ({ ...c, position: i }));
            setCols(updatedCols);
            onColumnMove(removed.id, destination.index, updatedCols);
            return;
        }

        // Task movement
        const sourceColId = parseInt(source.droppableId.replace("col-", ""));
        const destColId = parseInt(destination.droppableId.replace("col-", ""));

        const sourceTasks = Array.from(tasksByCol[sourceColId] || []);
        const [movedTask] = sourceTasks.splice(source.index, 1);

        const newTasksByCol = { ...tasksByCol };

        if (sourceColId === destColId) {
            sourceTasks.splice(destination.index, 0, movedTask);
            // update positions
            const updatedTasks = sourceTasks.map((t, idx) => ({ ...t, position: idx }));
            newTasksByCol[sourceColId] = updatedTasks;
        } else {
            const destTasks = Array.from(tasksByCol[destColId] || []);
            movedTask.column_id = destColId;
            destTasks.splice(destination.index, 0, movedTask);

            newTasksByCol[sourceColId] = sourceTasks.map((t, idx) => ({ ...t, position: idx }));
            newTasksByCol[destColId] = destTasks.map((t, idx) => ({ ...t, position: idx }));
        }

        setTasksByCol(newTasksByCol);
        onTaskMove(movedTask.id, destColId, destination.index, newTasksByCol);
    };

    const handleRenameSubmit = (colId: number) => {
        if (editingColName.trim()) {
            onRenameColumn(colId, editingColName.trim());
        }
        setEditingColId(null);
    };

    const handleAddColSubmit = () => {
        if (newColName.trim()) {
            onAddColumn(newColName.trim());
            setNewColName("");
            setIsAddingCol(false);
        }
    };

    return (
        <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="board" type="column" direction="horizontal">
                {(provided) => (
                    <div
                        className="flex gap-6 overflow-x-auto pb-4 items-start min-h-[500px]"
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                    >
                        {cols.map((col, index) => {
                            const columnHeaderStyles = getColumnHeaderStyles(col.name);

                            return (
                            <Draggable key={`col-${col.id}`} draggableId={`col-${col.id}`} index={index}>
                                {(providedCol, snapshotCol) => (
                                    <div
                                        ref={providedCol.innerRef}
                                        {...providedCol.draggableProps}
                                        className={cn(
                                            "flex flex-col bg-slate-50 dark:bg-slate-800/50 rounded-xl rounded-t-lg shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 h-full transition-all duration-300",
                                            collapsedCols[col.id] ? "w-[60px] min-w-[60px]" : "min-w-[320px] max-w-[320px]",
                                            snapshotCol.isDragging && "shadow-lg ring-sky-300 dark:ring-sky-600 rotate-2"
                                        )}
                                    >
                                        {/* Column Header */}
                                        <div
                                            {...providedCol.dragHandleProps}
                                            className={cn("rounded-t-lg flex group border-b",
                                                columnHeaderStyles.container,
                                                collapsedCols[col.id] ? "flex-col items-center py-4 h-full border-b-0 cursor-pointer" : "p-4 border-b items-center justify-between"
                                            )}
                                            onClick={() => {
                                                if (collapsedCols[col.id]) {
                                                    toggleCollapse(col.id);
                                                }
                                            }}
                                        >
                                            {collapsedCols[col.id] ? (
                                                <>
                                                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full mb-4", columnHeaderStyles.count)}>
                                                        {tasksByCol[col.id]?.length || 0}
                                                    </span>
                                                    <h3 style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }} className={cn("font-black text-xs uppercase tracking-widest rotate-180 flex-1 flex items-center justify-center", columnHeaderStyles.title)}>
                                                        {col.name}
                                                    </h3>
                                                </>
                                            ) : (
                                                <>
                                                    {editingColId === col.id ? (
                                                        <input
                                                            autoFocus
                                                            className="w-full bg-white dark:bg-slate-900 border border-sky-400 dark:border-sky-500 rounded px-2 py-1 text-sm font-bold shadow-inner focus:outline-none"
                                                            value={editingColName}
                                                            onChange={(e) => setEditingColName(e.target.value)}
                                                            onBlur={() => handleRenameSubmit(col.id)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") handleRenameSubmit(col.id);
                                                                if (e.key === "Escape") setEditingColId(null);
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="flex items-center gap-2 cursor-pointer flex-1" onClick={() => {
                                                            setEditingColId(col.id);
                                                            setEditingColName(col.name);
                                                        }}>
                                                            <h3 className={cn("font-black text-xs uppercase tracking-widest truncate max-w-[180px]", columnHeaderStyles.title)}>
                                                                {col.name}
                                                            </h3>
                                                            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", columnHeaderStyles.count)}>
                                                                {tasksByCol[col.id]?.length || 0}
                                                            </span>
                                                        </div>
                                                    )}

                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center ml-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 text-slate-400 hover:text-sky-500 mr-1"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleCollapse(col.id);
                                                            }}
                                                        >
                                                            <Minimize2 size={14} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onDeleteColumn(col.id);
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Column Droppable Area */}
                                        <Droppable droppableId={`col-${col.id}`} type="task">
                                            {(providedTask, snapshotTask) => (
                                                <div
                                                    ref={providedTask.innerRef}
                                                    {...providedTask.droppableProps}
                                                    className={cn(
                                                        "flex-1 p-3 space-y-3 transition-colors",
                                                        snapshotTask.isDraggingOver ? "bg-sky-50/50 dark:bg-sky-900/20" : "",
                                                        collapsedCols[col.id] ? "hidden" : "min-h-[150px]"
                                                    )}
                                                >
                                                    {tasksByCol[col.id]?.map((task, tIndex) => (
                                                        <Draggable key={`task-${task.id}`} draggableId={`task-${task.id}`} index={tIndex}>
                                                            {(providedDraggable, snapshotDraggable) => (
                                                                <div
                                                                    ref={providedDraggable.innerRef}
                                                                    {...providedDraggable.draggableProps}
                                                                    {...providedDraggable.dragHandleProps}
                                                                    className={cn(
                                                                        "bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg p-4 shadow-sm group hover:shadow-md transition-shadow relative overflow-hidden cursor-pointer",
                                                                        snapshotDraggable.isDragging ? "shadow-xl ring-2 ring-sky-400 dark:ring-sky-500 rotate-1" : "hover:border-slate-300 dark:hover:border-slate-600"
                                                                    )}
                                                                    onClick={() => onEditTask(task)}
                                                                >
                                                                    {/* Top Color Bar by Priority */}
                                                                    <div className={cn(
                                                                        "absolute top-0 left-0 w-full h-1",
                                                                        getTaskAccentBarClass(task, col.name)
                                                                    )} />

                                                                    <div className="flex justify-between items-start gap-2 mb-2">
                                                                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1 leading-snug">
                                                                            {task.title}
                                                                        </h4>

                                                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-slate-900/90 rounded border dark:border-slate-700 shadow-sm">
                                                                            <button onClick={(e) => { e.stopPropagation(); onDeleteTask(task.id); }} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    </div>

                                                                    {task.description && (
                                                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                                                                            {task.description}
                                                                        </p>
                                                                    )}

                                                                    <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-500 mt-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">
                                                                                <CalendarIcon size={10} />
                                                                                {new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex gap-2 items-center">
                                                                            {task.type === "assigned" && task.assigned_to_user && (
                                                                                <div className="flex gap-1 items-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100 dark:border-blue-800/50">
                                                                                    <UserIcon size={10} />
                                                                                    <span className="truncate max-w-[60px]">{task.assigned_to_user.name}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                                    {providedTask.placeholder}

                                                    {/* Add Task Button inside Column */}
                                                    <div
                                                        onClick={() => onAddTask(col.id)}
                                                        className="flex items-center justify-center p-2 text-slate-400 dark:text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20 rounded-lg cursor-pointer transition-colors border border-dashed border-transparent hover:border-sky-200 dark:hover:border-sky-800 mt-2"
                                                    >
                                                        <Plus size={16} className="mr-1" />
                                                        <span className="text-xs font-semibold uppercase tracking-wider">Add Task</span>
                                                    </div>
                                                </div>
                                            )}
                                        </Droppable>
                                    </div>
                                )}
                            </Draggable>
                            );
                        })}
                        {provided.placeholder}

                        {/* Add Column Button */}
                        <div className="min-w-[320px] max-w-[320px] h-full flex-shrink-0">
                            {isAddingCol ? (
                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-sky-300 dark:border-sky-700">
                                    <input
                                        autoFocus
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-3 py-2 text-sm focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 mb-2"
                                        placeholder="Column title..."
                                        value={newColName}
                                        onChange={(e) => setNewColName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleAddColSubmit();
                                            if (e.key === "Escape") setIsAddingCol(false);
                                        }}
                                    />
                                    <div className="flex gap-2">
                                        <Button className="h-8 flex-1 bg-sky-600 hover:bg-sky-500" onClick={handleAddColSubmit}>Add</Button>
                                        <Button className="h-8 flex-1" variant="outline" onClick={() => setIsAddingCol(false)}>Cancel</Button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setIsAddingCol(true)}
                                    className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                >
                                    <Plus size={18} />
                                    <span className="text-sm font-bold uppercase tracking-widest">Add Column</span>
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Droppable>
        </DragDropContext>
    );
};

export default DynamicKanbanBoard;
