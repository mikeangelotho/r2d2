import { createSignal, For, Show, createMemo } from "solid-js";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

type JsonType = "string" | "number" | "boolean" | "null" | "object" | "array";

interface Props {
  data: unknown;
  onChange: (path: string[], value: JsonValue) => void;
  onNodeClick?: (path: string[], value: JsonValue) => void;
  onDuplicate?: (path: string[], value: JsonValue) => void;
}

interface TableEntry {
  key: string;
  path: string[];
  value: JsonValue;
  type: JsonType;
  isGroup: boolean;
  children?: TableEntry[];
}

function getValueAtPath(obj: unknown, path: string[]): JsonValue {
  let current: unknown = obj;
  for (const key of path) {
    if (current === null || current === undefined) return null;
    if (typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return null;
    }
  }
  return current as JsonValue;
}

function getType(val: JsonValue): JsonType {
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  if (typeof val === "object") return "object";
  return typeof val as JsonType;
}

function isObject(val: unknown): val is JsonObject {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function isArray(val: unknown): val is JsonArray {
  return Array.isArray(val);
}

function getDefaultValue(type: JsonType): JsonValue {
  switch (type) {
    case "string":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "null":
      return null;
    case "object":
      return {};
    case "array":
      return [];
  }
}

function buildTableEntries(
  obj: unknown,
  path: string[] = [],
  key: string = "root",
): TableEntry[] {
  const entries: TableEntry[] = [];
  const type = getType(obj as JsonValue);

  if (type === "object") {
    const objVal = obj as JsonObject;
    const keys = Object.keys(objVal);
    const childEntries: TableEntry[] = [];

    for (const k of keys) {
      const val = objVal[k];
      const valType = getType(val);

      if (valType === "object" || valType === "array") {
        childEntries.push(...buildTableEntries(val, [...path, k], k));
      } else {
        childEntries.push({
          key: k,
          path: [...path, k],
          value: val,
          type: valType,
          isGroup: false,
        });
      }
    }

    if (childEntries.length > 0) {
      entries.push({
        key,
        path,
        value: obj as JsonValue,
        type: "object",
        isGroup: true,
        children: childEntries,
      });
    }
  } else if (type === "array") {
    const arrVal = obj as JsonArray;
    const childEntries: TableEntry[] = [];

    arrVal.forEach((item, index) => {
      const itemPath = [...path, String(index)];
      const itemType = getType(item);

      if (itemType === "object" || itemType === "array") {
        childEntries.push(...buildTableEntries(item, itemPath, String(index)));
      } else {
        childEntries.push({
          key: String(index),
          path: itemPath,
          value: item,
          type: itemType,
          isGroup: false,
        });
      }
    });

    entries.push({
      key,
      path,
      value: obj as JsonValue,
      type: "array",
      isGroup: true,
      children: childEntries,
    });
  } else {
    entries.push({
      key,
      path,
      value: obj as JsonValue,
      type,
      isGroup: false,
    });
  }

  return entries;
}

function ValueEditor(props: {
  value: JsonValue;
  path: string[];
  onChange: (path: string[], value: JsonValue) => void;
}) {
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");

  const startEdit = () => {
    setEditValue(props.value === null ? "null" : String(props.value));
    setEditing(true);
  };

  const saveEdit = () => {
    let newValue: JsonValue = editValue();

    if (editValue() === "null") {
      newValue = null;
    } else if (editValue() === "true") {
      newValue = true;
    } else if (editValue() === "false") {
      newValue = false;
    } else if (!isNaN(Number(editValue()))) {
      newValue = Number(editValue());
    }

    props.onChange(props.path, newValue);
    setEditing(false);
  };

  const cancelEdit = () => {
    setEditing(false);
  };

  return (
    <Show when={editing()}>
      <input
        type="text"
        value={editValue()}
        onInput={(e) => setEditValue(e.currentTarget.value)}
        onBlur={saveEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter") saveEdit();
          if (e.key === "Escape") cancelEdit();
        }}
        class="px-1 bg-[var(--bg-primary)] border border-[var(--accent)] rounded text-sm w-32 focus:outline-none"
        autofocus
      />
    </Show>
  );
}

function TypeSelector(props: {
  onSelect: (type: JsonType) => void;
  onClose: () => void;
}) {
  const types: JsonType[] = [
    "string",
    "number",
    "boolean",
    "null",
    "object",
    "array",
  ];

  return (
    <div class="absolute z-20 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-lg py-1 min-w-[120px]">
      <For each={types}>
        {(type) => (
          <button
            type="button"
            onClick={() => props.onSelect(type)}
            class="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] capitalize"
          >
            {type}
          </button>
        )}
      </For>
      <div class="border-t border-[var(--border-subtle)] mt-1 pt-1">
        <button
          type="button"
          onClick={props.onClose}
          class="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TableRow(props: {
  entry: TableEntry;
  depth: number;
  onChange: (path: string[], value: JsonValue) => void;
  onNodeClick?: (path: string[], value: JsonValue) => void;
  onDuplicate?: (path: string[], value: JsonValue) => void;
  onDelete: (path: string[]) => void;
  onKeyRename: (oldPath: string[], newKey: string) => void;
  expandedGroups: Set<string>;
  toggleGroup: (path: string) => void;
}) {
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");
  const [editingKey, setEditingKey] = createSignal(false);
  const [newKey, setNewKey] = createSignal("");
  const [showTypeSelector, setShowTypeSelector] = createSignal(false);
  const [showDuplicateMenu, setShowDuplicateMenu] = createSignal(false);

  const isExpanded = () => props.expandedGroups.has(props.entry.path.join("."));
  const isPrimitive = () => !props.entry.isGroup;

  const startEdit = () => {
    if (props.entry.isGroup) return;
    setEditValue(
      props.entry.value === null ? "null" : String(props.entry.value),
    );
    setEditing(true);
  };

  const saveEdit = () => {
    let newValue: JsonValue = editValue();

    if (editValue() === "null") {
      newValue = null;
    } else if (editValue() === "true") {
      newValue = true;
    } else if (editValue() === "false") {
      newValue = false;
    } else if (!isNaN(Number(editValue()))) {
      newValue = Number(editValue());
    }

    props.onChange(props.entry.path, newValue);
    setEditing(false);
  };

  const handleDelete = () => {
    props.onDelete(props.entry.path);
  };

  const handleKeyRename = () => {
    setNewKey(props.entry.key);
    setEditingKey(true);
  };

  const saveKeyRename = () => {
    if (newKey() && newKey() !== props.entry.key) {
      props.onKeyRename(props.entry.path, newKey());
    }
    setEditingKey(false);
  };

  const handleDuplicateAsSibling = () => {
    if (props.onDuplicate) {
      props.onDuplicate(props.entry.path, props.entry.value);
    }
    setShowDuplicateMenu(false);
  };

  const handleCopy = async () => {
    const valueToCopy = props.entry.isGroup
      ? JSON.stringify(props.entry.value, null, 2)
      : props.entry.value === null
        ? "null"
        : String(props.entry.value);
    await navigator.clipboard.writeText(valueToCopy);
  };

  const handleGroupClick = () => {
    if (props.entry.isGroup && props.onNodeClick) {
      const groupPath =
        props.entry.path.length > 0 ? props.entry.path.slice(0, -1) : [];
      const parentObj = getValueAtPath(
        props.entry.path.length > 0
          ? getValueAtPath({}, groupPath.slice(0, -1))
          : {},
        groupPath,
      );
      if (parentObj && typeof parentObj === "object") {
        props.onNodeClick(props.entry.path, props.entry.value);
      }
    }
  };

  const colorClass = () => {
    switch (props.entry.type) {
      case "string":
        return "text-green-400";
      case "number":
        return "text-blue-400";
      case "boolean":
        return "text-purple-400";
      case "null":
        return "text-gray-500";
      default:
        return "text-white";
    }
  };

  const getChildCount = () => {
    if (!props.entry.children) return 0;
    return props.entry.children.filter((c) => !c.isGroup).length;
  };

  return (
    <>
      <tr class="border-b border-[var(--border-subtle)] hover:bg-[var(--bg-tertiary)] group">
        <td
          class="py-2 px-3"
          style={{ "padding-left": `${props.depth * 24 + 12}px` }}
        >
          <Show when={props.entry.isGroup}>
            <button
              type="button"
              onClick={() => props.toggleGroup(props.entry.path.join("."))}
              class="text-[var(--text-muted)] hover:text-[var(--text-primary)] mr-1 text-xs"
            >
              {isExpanded() ? "▼" : "▶"}
            </button>
          </Show>
          <Show when={!props.entry.isGroup}>
            <span class="w-4 inline-block mr-1" />
          </Show>

          <Show
            when={editingKey()}
            fallback={
              <span
                class="text-yellow-400 font-mono text-sm cursor-pointer hover:bg-[var(--bg-tertiary)] px-1 rounded"
                onClick={handleKeyRename}
              >
                {props.entry.key}
              </span>
            }
          >
            <input
              type="text"
              value={newKey()}
              onInput={(e) => setNewKey(e.currentTarget.value)}
              onBlur={saveKeyRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveKeyRename();
                if (e.key === "Escape") setEditingKey(false);
              }}
              class="px-1 bg-[var(--bg-primary)] border border-[var(--accent)] rounded text-sm w-24 focus:outline-none"
              autofocus
            />
          </Show>
        </td>

        <td class="py-2 px-3 font-mono text-sm">
          <Show when={props.entry.isGroup}>
            <Show when={props.entry.type === "array"}>
              <span
                class="text-[var(--text-muted)] text-sm cursor-pointer hover:text-[var(--accent)]"
                onClick={handleGroupClick}
              >
                [{props.entry.children?.length || 0}]
              </span>
            </Show>
            <Show when={props.entry.type === "object"}>
              <span
                class="text-[var(--text-muted)] text-sm cursor-pointer hover:text-[var(--accent)]"
                onClick={handleGroupClick}
              >
                {"{" + getChildCount() + "}"}
              </span>
            </Show>
          </Show>
          <Show when={!props.entry.isGroup}>
            <Show when={editing()}>
              <input
                type="text"
                value={editValue()}
                onInput={(e) => setEditValue(e.currentTarget.value)}
                onBlur={saveEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit();
                  if (e.key === "Escape") setEditing(false);
                }}
                class="px-2 py-1 bg-[var(--bg-primary)] border border-[var(--accent)] rounded text-sm w-full focus:outline-none"
                autofocus
              />
            </Show>
            <Show when={!editing()}>
              <span
                class={`cursor-pointer hover:bg-[var(--bg-tertiary)] px-1 rounded ${colorClass()}`}
                onClick={startEdit}
              >
                <Show when={props.entry.type === "string"}>
                  "{String(props.entry.value)}"
                </Show>
                <Show when={props.entry.type !== "string"}>
                  {String(props.entry.value)}
                </Show>
              </span>
            </Show>
          </Show>
        </td>

        <td class="py-2 px-3 text-[var(--text-muted)] text-xs">
          {props.entry.type}
        </td>

        <td class="py-2 px-3 text-right">
          <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
            <Show when={props.entry.isGroup}>
              <div class="relative">
                <button
                  type="button"
                  onClick={() => setShowTypeSelector(!showTypeSelector())}
                  class="text-[var(--accent)] hover:text-[var(--accent)] text-xs px-1"
                  title="Add"
                >
                  +
                </button>
                <Show when={showTypeSelector()}>
                  <TypeSelector
                    onSelect={(type) => {
                      const newValue = getDefaultValue(type);
                      props.onChange(props.entry.path, newValue);
                      setShowTypeSelector(false);
                    }}
                    onClose={() => setShowTypeSelector(false)}
                  />
                </Show>
              </div>
            </Show>
            <Show when={!props.entry.isGroup}>
              <div class="relative">
                <button
                  type="button"
                  onClick={() => setShowDuplicateMenu(!showDuplicateMenu())}
                  class="text-blue-400 hover:text-blue-300 text-xs px-1"
                  title="Duplicate"
                >
                  ⧉
                </button>
                <Show when={showDuplicateMenu()}>
                  <div class="absolute z-30 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-lg py-1 min-w-[120px] right-0 mt-1">
                    <button
                      type="button"
                      onClick={handleDuplicateAsSibling}
                      class="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                    >
                      ↗ As sibling
                    </button>
                  </div>
                </Show>
              </div>
            </Show>
            <Show
              when={
                props.entry.isGroup &&
                (props.entry.type === "object" || props.entry.type === "array")
              }
            >
              <div class="relative">
                <button
                  type="button"
                  onClick={() => setShowDuplicateMenu(!showDuplicateMenu())}
                  class="text-blue-400 hover:text-blue-300 text-xs px-1"
                  title="Duplicate"
                >
                  ⧉
                </button>
                <Show when={showDuplicateMenu()}>
                  <div class="absolute z-30 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded shadow-lg py-1 min-w-[120px] right-0 mt-1">
                    <button
                      type="button"
                      onClick={handleDuplicateAsSibling}
                      class="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                    >
                      ↗ As sibling
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const clonedValue = JSON.parse(
                          JSON.stringify(props.entry.value),
                        );
                        if (props.entry.type === "array") {
                          const newArray = [
                            ...(props.entry.value as JsonArray),
                            clonedValue,
                          ];
                          props.onChange(props.entry.path, newArray);
                        } else if (props.entry.type === "object") {
                          let newKeyName = `${props.entry.key}_copy`;
                          let counter = 1;
                          const obj = props.entry.value as JsonObject;
                          while (newKeyName in obj) {
                            newKeyName = `${props.entry.key}_copy_${counter++}`;
                          }
                          const newObj: JsonObject = {
                            ...obj,
                            [newKeyName]: clonedValue,
                          };
                          props.onChange(props.entry.path, newObj);
                        }
                        setShowDuplicateMenu(false);
                      }}
                      class="w-full text-left px-3 py-1.5 text-sm hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                    >
                      ↙ Inside
                    </button>
                  </div>
                </Show>
              </div>
            </Show>
            <Show when={!props.entry.isGroup}>
              <button
                type="button"
                onClick={handleCopy}
                class="text-[var(--text-muted)] hover:text-[var(--text-primary)] text-xs px-1"
                title="Copy value"
              >
                📋
              </button>
            </Show>
            <button
              type="button"
              onClick={handleDelete}
              class="text-[var(--error)] hover:text-[var(--error)] text-xs px-1"
              title="Delete"
            >
              ×
            </button>
          </div>
        </td>
      </tr>

      <Show when={props.entry.isGroup && isExpanded() && props.entry.children}>
        <For each={props.entry.children}>
          {(child) => (
            <TableRow
              entry={child}
              depth={props.depth + 1}
              onChange={props.onChange}
              onNodeClick={props.onNodeClick}
              onDuplicate={props.onDuplicate}
              onDelete={props.onDelete}
              onKeyRename={props.onKeyRename}
              expandedGroups={props.expandedGroups}
              toggleGroup={props.toggleGroup}
            />
          )}
        </For>
      </Show>
    </>
  );
}

export default function JsonTableView(props: Props) {
  const [showTypeSelector, setShowTypeSelector] = createSignal(false);
  const [expandedGroups, setExpandedGroups] = createSignal<Set<string>>(
    new Set(),
  );

  const entries = createMemo(() => buildTableEntries(props.data));

  const updateAtPath = (
    obj: unknown,
    path: string[],
    value: JsonValue,
  ): unknown => {
    if (path.length === 0) return value;

    const newObj = Array.isArray(obj) ? [...obj] : { ...(obj as JsonObject) };
    const [first, ...rest] = path;

    if (rest.length === 0) {
      (newObj as Record<string, unknown>)[first] = value;
    } else {
      (newObj as Record<string, unknown>)[first] = updateAtPath(
        (newObj as Record<string, unknown>)[first],
        rest,
        value,
      );
    }

    return newObj;
  };

  const handleChange = (path: string[], value: JsonValue) => {
    const newData = updateAtPath(props.data, path, value);
    props.onChange([], newData as JsonValue);
  };

  const handleDelete = (path: string[]) => {
    if (path.length === 0) return;

    const parentPath = path.slice(0, -1);
    const key = path[path.length - 1];
    const parent = getValueAtPath(props.data, parentPath);

    if (isArray(parent)) {
      const newArray = [...(parent as JsonArray)];
      const index = parseInt(key);
      newArray.splice(index, 1);
      const newData = updateAtPath(props.data, parentPath, newArray);
      props.onChange([], newData as JsonValue);
    } else if (isObject(parent)) {
      const newObj = { ...(parent as JsonObject) };
      delete newObj[key];
      const newData = updateAtPath(props.data, parentPath, newObj);
      props.onChange([], newData as JsonValue);
    }
  };

  const handleKeyRename = (path: string[], newKey: string) => {
    if (path.length === 0) return;

    const parentPath = path.slice(0, -1);
    const oldKey = path[path.length - 1];
    const parent = getValueAtPath(props.data, parentPath);

    if (isObject(parent)) {
      const newObj: JsonObject = {};
      for (const [k, v] of Object.entries(parent)) {
        if (k === oldKey) {
          newObj[newKey] = v;
        } else {
          newObj[k] = v;
        }
      }
      const newData = updateAtPath(props.data, parentPath, newObj);
      props.onChange([], newData as JsonValue);
    }
  };

  const handleDuplicate = (path: string[], value: JsonValue) => {
    if (path.length === 0) return;

    const parentPath = path.slice(0, -1);
    const currentKey = path[path.length - 1];
    const parent = getValueAtPath(props.data, parentPath);

    if (isObject(parent)) {
      let newKeyName = `${currentKey}_copy`;
      let counter = 1;
      while (newKeyName in parent) {
        newKeyName = `${currentKey}_copy_${counter++}`;
      }
      const clonedValue = JSON.parse(JSON.stringify(value));
      const updatedParent: JsonObject = {
        ...parent,
        [newKeyName]: clonedValue,
      };
      const newData = updateAtPath(props.data, parentPath, updatedParent);
      props.onChange([], newData as JsonValue);
    } else if (isArray(parent)) {
      const clonedValue = JSON.parse(JSON.stringify(value));
      const updatedParent: JsonArray = [...(parent as JsonArray), clonedValue];
      const newData = updateAtPath(props.data, parentPath, updatedParent);
      props.onChange([], newData as JsonValue);
    }
  };

  const toggleGroup = (pathKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) {
        next.delete(pathKey);
      } else {
        next.add(pathKey);
      }
      return next;
    });
  };

  const handleAddProperty = (jsonType: JsonType) => {
    if (!isObject(props.data)) return;

    let newKeyName = "new_field";
    let counter = 1;

    while (newKeyName in (props.data as JsonObject)) {
      newKeyName = `new_field_${counter++}`;
    }

    const newValue = getDefaultValue(jsonType);
    const updatedObj: JsonObject = {
      ...(props.data as JsonObject),
      [newKeyName]: newValue,
    };
    props.onChange([], updatedObj as JsonValue);
    setShowTypeSelector(false);
  };

  const handleAddArrayItem = (jsonType: JsonType) => {
    if (!isArray(props.data)) return;

    const newValue = getDefaultValue(jsonType);
    const updatedArray: JsonArray = [...(props.data as JsonArray), newValue];
    props.onChange([], updatedArray as JsonValue);
    setShowTypeSelector(false);
  };

  const handleTypeSelect = (jsonType: JsonType) => {
    if (isObject(props.data)) {
      handleAddProperty(jsonType);
    } else if (isArray(props.data)) {
      handleAddArrayItem(jsonType);
    }
  };

  const expandAll = () => {
    const allPaths = new Set<string>();
    const collectPaths = (ents: TableEntry[]) => {
      for (const ent of ents) {
        if (ent.isGroup && ent.path.length > 0) {
          allPaths.add(ent.path.join("."));
          if (ent.children) collectPaths(ent.children);
        }
      }
    };
    collectPaths(entries());
    setExpandedGroups(allPaths);
  };

  const collapseAll = () => {
    setExpandedGroups(new Set<string>());
  };

  return (
    <div class="overflow-auto max-h-full">
      <div class="flex items-center justify-end mb-2 gap-2">
        <button
          type="button"
          onClick={expandAll}
          class="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded"
        >
          Expand All
        </button>
        <button
          type="button"
          onClick={collapseAll}
          class="px-2 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded"
        >
          Collapse All
        </button>
        <div class="relative">
          <button
            type="button"
            onClick={() => setShowTypeSelector(!showTypeSelector())}
            class="flex items-center gap-1 px-2 py-1 text-xs text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded"
          >
            + {isArray(props.data) ? "Add Item" : "Add Property"}
          </button>
          <Show when={showTypeSelector()}>
            <TypeSelector
              onSelect={handleTypeSelect}
              onClose={() => setShowTypeSelector(false)}
            />
          </Show>
        </div>
      </div>

      <table class="w-full text-left border-collapse">
        <thead class="sticky top-0 bg-[var(--bg-secondary)]">
          <tr class="border-b border-[var(--border-subtle)]">
            <th class="py-2 px-3 text-[var(--text-secondary)] text-sm font-medium w-1/4">
              Key
            </th>
            <th class="py-2 px-3 text-[var(--text-secondary)] text-sm font-medium">
              Value
            </th>
            <th class="py-2 px-3 text-[var(--text-secondary)] text-sm font-medium w-20">
              Type
            </th>
            <th class="py-2 px-3 text-[var(--text-secondary)] text-sm font-medium w-16 text-right">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <For each={entries()}>
            {(entry) => (
              <TableRow
                entry={entry}
                depth={0}
                onChange={handleChange}
                onNodeClick={props.onNodeClick}
                onDuplicate={props.onDuplicate || handleDuplicate}
                onDelete={handleDelete}
                onKeyRename={handleKeyRename}
                expandedGroups={expandedGroups()}
                toggleGroup={toggleGroup}
              />
            )}
          </For>
        </tbody>
      </table>

      <Show when={entries().length === 0}>
        <p class="text-[var(--text-muted)] text-center py-4">No values</p>
      </Show>
    </div>
  );
}
