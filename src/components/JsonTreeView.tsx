import { createSignal, For, Show, createMemo } from "solid-js";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

interface Props {
  data: unknown;
  onChange: (path: string[], value: JsonValue) => void;
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

function isObject(val: unknown): val is JsonObject {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function isArray(val: unknown): val is JsonArray {
  return Array.isArray(val);
}

function getType(val: JsonValue): string {
  if (val === null) return "null";
  if (isArray(val)) return "array";
  if (isObject(val)) return "object";
  return typeof val;
}

function ValueEditor(props: { value: JsonValue; path: string[]; onChange: (path: string[], value: JsonValue) => void }) {
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");

  const startEdit = () => {
    if (isObject(props.value) || isArray(props.value)) return;
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

  const type = () => getType(props.value);

  const colorClass = () => {
    switch (type()) {
      case "string": return "text-green-400";
      case "number": return "text-blue-400";
      case "boolean": return "text-purple-400";
      case "null": return "text-gray-500";
      default: return "text-white";
    }
  };

  return (
    <Show
      when={editing()}
      fallback={
        <span
          class={`cursor-pointer hover:bg-slate-700 px-1 rounded ${colorClass()}`}
          onClick={startEdit}
        >
          <Show when={type() === "string"}>
            "{String(props.value)}"
          </Show>
          <Show when={type() !== "string"}>
            {String(props.value)}
          </Show>
        </span>
      }
    >
      <input
        type="text"
        value={editValue()}
        onInput={(e) => setEditValue(e.currentTarget.value)}
        onBlur={saveEdit}
        onKeyDown={(e) => {
          if (e.key === "Enter") saveEdit();
          if (e.key === "Escape") cancelEdit();
        }}
        class="px-1 bg-slate-700 border border-sky-500 rounded text-white text-sm w-32 focus:outline-none"
        autofocus
      />
    </Show>
  );
}

function TreeNode(props: { keyName: string; value: JsonValue; path: string[]; onChange: (path: string[], value: JsonValue) => void; isLast: boolean }) {
  const [collapsed, setCollapsed] = createSignal(false);
  
  const type = () => getType(props.value);
  const isExpandable = () => type() === "object" || type() === "array";
  
  const handleDelete = () => {
    const newValue: JsonValue = null;
    props.onChange(props.path, newValue);
  };

  return (
    <div class="ml-4">
      <div class="flex items-center py-0.5">
        <Show when={isExpandable()}>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed())}
            class="text-gray-500 hover:text-white mr-1"
          >
            {collapsed() ? "▶" : "▼"}
          </button>
        </Show>
        <Show when={!isExpandable()}>
          <span class="w-4 mr-1" />
        </Show>
        
        <span class="text-yellow-300 mr-1">"{props.keyName}"</span>
        <span class="text-gray-500 mr-1">:</span>
        
        <Show when={type() === "object" || type() === "array"}>
          <span class="text-gray-500 text-sm">
            {collapsed() ? (
              <span>{type() === "array" ? `[${(props.value as JsonArray).length}]` : `{${Object.keys(props.value as JsonObject).length}}`}</span>
            ) : (
              <span>{type()}</span>
            )}
          </span>
        </Show>
        
        <Show when={type() !== "object" && type() !== "array"}>
          <ValueEditor value={props.value} path={props.path} onChange={props.onChange} />
        </Show>
        
        <button
          type="button"
          onClick={handleDelete}
          class="ml-2 text-red-500 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100"
        >
          ✕
        </button>
      </div>
      
      <Show when={isExpandable() && !collapsed()}>
        <div class="border-l border-slate-700 ml-2">
          <Show when={type() === "object"}>
            <For each={Object.entries(props.value as JsonObject)}>
              {([key, val], index, arr) => (
                <TreeNode
                  keyName={key}
                  value={val}
                  path={[...props.path, key]}
                  onChange={props.onChange}
                  isLast={index() === arr().length - 1}
                />
              )}
            </For>
          </Show>
          <Show when={type() === "array"}>
            <For each={props.value as JsonArray}>
              {(item, index) => (
                <TreeNode
                  keyName={String(index())}
                  value={item}
                  path={[...props.path, String(index())]}
                  onChange={props.onChange}
                  isLast={index() === (props.value as JsonArray).length - 1}
                />
              )}
            </For>
          </Show>
        </div>
      </Show>
    </div>
  );
}

export default function JsonTreeView(props: Props) {
  const updateAtPath = (obj: unknown, path: string[], value: JsonValue): unknown => {
    if (path.length === 0) return value;
    
    const newObj = Array.isArray(obj) ? [...obj] : { ...(obj as JsonObject) };
    const [first, ...rest] = path;
    
    if (rest.length === 0) {
      (newObj as Record<string, unknown>)[first] = value;
    } else {
      (newObj as Record<string, unknown>)[first] = updateAtPath(
        (newObj as Record<string, unknown>)[first],
        rest,
        value
      );
    }
    
    return newObj;
  };

  const handleChange = (path: string[], value: JsonValue) => {
    const newData = updateAtPath(props.data, path, value);
    props.onChange([], newData);
  };

  return (
    <div class="font-mono text-sm overflow-auto max-h-full">
      <Show when={isObject(props.data) || isArray(props.data)}>
        <div class="group">
          <TreeNode
            keyName="root"
            value={props.data as JsonValue}
            path={[]}
            onChange={handleChange}
            isLast={true}
          />
        </div>
      </Show>
      <Show when={!isObject(props.data) && !isArray(props.data)}>
        <ValueEditor value={props.data as JsonValue} path={[]} onChange={handleChange} />
      </Show>
    </div>
  );
}
