import { createSignal, For, Show, createMemo } from "solid-js";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

interface Props {
  data: unknown;
  onChange: (path: string[], value: JsonValue) => void;
  onNodeClick?: (path: string[], value: JsonValue) => void;
  onDuplicate?: (path: string[], value: JsonValue) => void;
}

type JsonType = "string" | "number" | "boolean" | "null" | "object" | "array";

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

function getDefaultValue(type: JsonType): JsonValue {
  switch (type) {
    case "string": return "";
    case "number": return 0;
    case "boolean": return false;
    case "null": return null;
    case "object": return {};
    case "array": return [];
  }
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

function TypeSelector(props: { onSelect: (type: JsonType) => void; onClose: () => void }) {
  const types: JsonType[] = ["string", "number", "boolean", "null", "object", "array"];
  
  return (
    <div class="absolute z-20 bg-slate-800 border border-slate-600 rounded shadow-lg py-1 min-w-[120px]">
      <For each={types}>
        {(type) => (
          <button
            type="button"
            onClick={() => props.onSelect(type)}
            class="w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-slate-700 text-white capitalize"
          >
            {type}
          </button>
        )}
      </For>
      <div class="border-t border-slate-600 mt-1 pt-1">
        <button
          type="button"
          onClick={props.onClose}
          class="w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-slate-700 text-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TreeNode(props: { keyName: string; value: JsonValue; path: string[]; onChange: (path: string[], value: JsonValue) => void; onNodeClick?: (path: string[], value: JsonValue) => void; onDuplicate?: (path: string[], value: JsonValue) => void; isLast: boolean }) {
  const [collapsed, setCollapsed] = createSignal(false);
  const [showTypeSelector, setShowTypeSelector] = createSignal(false);
  const [showDuplicateMenu, setShowDuplicateMenu] = createSignal(false);
  const [editingKey, setEditingKey] = createSignal(false);
  const [newKey, setNewKey] = createSignal("");
  
  const type = () => getType(props.value);
  const isExpandable = () => type() === "object" || type() === "array";
  
  const handleDelete = () => {
    const newValue: JsonValue = null;
    props.onChange(props.path, newValue);
  };

  const handleExpandClick = (e: MouseEvent) => {
    e.stopPropagation();
    setCollapsed(!collapsed());
  };

  const handleNodeClick = () => {
    if (props.onNodeClick && isExpandable()) {
      props.onNodeClick(props.path, props.value);
    }
  };

  const handleAddProperty = (jsonType: JsonType) => {
    const currentObj = props.value as JsonObject;
    let newKeyName = "new_field";
    let counter = 1;
    
    while (newKeyName in currentObj) {
      newKeyName = `new_field_${counter++}`;
    }
    
    const newValue = getDefaultValue(jsonType);
    const updatedObj: JsonObject = { ...currentObj, [newKeyName]: newValue };
    props.onChange(props.path, updatedObj);
    setShowTypeSelector(false);
  };

  const handleAddArrayItem = (jsonType: JsonType) => {
    const currentArray = props.value as JsonArray;
    const newValue = getDefaultValue(jsonType);
    const updatedArray: JsonArray = [...currentArray, newValue];
    props.onChange(props.path, updatedArray);
    setShowTypeSelector(false);
  };

  const handleTypeSelect = (jsonType: JsonType) => {
    if (type() === "object") {
      handleAddProperty(jsonType);
    } else if (type() === "array") {
      handleAddArrayItem(jsonType);
    }
  };

  const handleDuplicateAsSibling = () => {
    if (props.onDuplicate) {
      props.onDuplicate(props.path, props.value);
    }
    setShowDuplicateMenu(false);
  };

  const handleDuplicateInside = () => {
    if (type() === "object") {
      const currentObj = props.value as JsonObject;
      let newKeyName = `${props.keyName}_copy`;
      let counter = 1;
      while (newKeyName in currentObj) {
        newKeyName = `${props.keyName}_copy_${counter++}`;
      }
      const clonedValue = JSON.parse(JSON.stringify(props.value));
      const updatedObj: JsonObject = { ...currentObj, [newKeyName]: clonedValue };
      props.onChange(props.path, updatedObj);
    } else if (type() === "array") {
      const currentArray = props.value as JsonArray;
      const clonedValue = JSON.parse(JSON.stringify(props.value));
      const updatedArray: JsonArray = [...currentArray, clonedValue];
      props.onChange(props.path, updatedArray);
    }
    setShowDuplicateMenu(false);
  };

  return (
    <div class="ml-4">
      <div class="flex items-center py-0.5">
        <Show when={isExpandable()}>
          <button
            type="button"
            onClick={handleExpandClick}
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
          <span 
            class="text-gray-500 text-sm cursor-pointer hover:text-[var(--accent)]"
            onClick={handleNodeClick}
          >
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
        <div class="relative">
          <button
            type="button"
            onClick={() => setShowDuplicateMenu(!showDuplicateMenu())}
            class="ml-1 text-blue-400 hover:text-blue-300 text-xs opacity-0 group-hover:opacity-100"
            title="Duplicate"
          >
            ⧉
          </button>
          <Show when={showDuplicateMenu()}>
            <div class="absolute z-30 bg-slate-800 border border-slate-600 rounded shadow-lg py-1 min-w-[140px] left-0 mt-1">
              <button
                type="button"
                onClick={handleDuplicateAsSibling}
                class="w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-slate-700 text-white"
              >
                ↗ As sibling
              </button>
              <button
                type="button"
                onClick={handleDuplicateInside}
                class="w-full text-left px-3 py-1.5 text-sm font-mono hover:bg-slate-700 text-white"
              >
                ↙ Inside
              </button>
            </div>
          </Show>
        </div>
      </div>
      
      <Show when={isExpandable() && !collapsed()}>
        <div class="border-l border-slate-700 ml-2">
          <Show when={type() === "object"}>
            <For each={Object.entries(props.value as JsonObject)}>
                {([key, val]: [string, JsonValue]) => (
                <TreeNode
                  keyName={key}
                  value={val}
                  path={[...props.path, key]}
                  onChange={props.onChange}
                  onNodeClick={props.onNodeClick}
                  onDuplicate={props.onDuplicate}
                  isLast={Object.keys(props.value as JsonObject).indexOf(key) === Object.keys(props.value as JsonObject).length - 1}
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
                  onNodeClick={props.onNodeClick}
                  onDuplicate={props.onDuplicate}
                  isLast={index() === (props.value as JsonArray).length - 1}
                />
              )}
            </For>
          </Show>
          
          <div class="mt-1 pt-1 border-t border-slate-700/50">
            <div class="relative">
              <button
                type="button"
                onClick={() => setShowTypeSelector(!showTypeSelector())}
                class="flex items-center gap-1 px-2 py-1 text-xs font-mono text-[var(--accent)] hover:bg-slate-700/50 rounded"
              >
                + {type() === "array" ? "Add Item" : "Add Property"}
              </button>
              <Show when={showTypeSelector()}>
                <TypeSelector 
                  onSelect={handleTypeSelect} 
                  onClose={() => setShowTypeSelector(false)} 
                />
              </Show>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

export default function JsonTreeView(props: Props) {
  const [showTypeSelector, setShowTypeSelector] = createSignal(false);
  
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
    props.onChange([], newData as JsonValue);
  };

  const handleAddRootProperty = (jsonType: JsonType) => {
    if (!isObject(props.data)) return;
    
    let newKeyName = "new_field";
    let counter = 1;
    
    while (newKeyName in (props.data as JsonObject)) {
      newKeyName = `new_field_${counter++}`;
    }
    
    const newValue = getDefaultValue(jsonType);
    const updatedObj: JsonObject = { ...(props.data as JsonObject), [newKeyName]: newValue };
    props.onChange([], updatedObj as JsonValue);
    setShowTypeSelector(false);
  };

  const handleAddRootArrayItem = (jsonType: JsonType) => {
    if (!isArray(props.data)) return;
    
    const newValue = getDefaultValue(jsonType);
    const updatedArray: JsonArray = [...(props.data as JsonArray), newValue];
    props.onChange([], updatedArray as JsonValue);
    setShowTypeSelector(false);
  };

  const handleRootTypeSelect = (jsonType: JsonType) => {
    if (isObject(props.data)) {
      handleAddRootProperty(jsonType);
    } else if (isArray(props.data)) {
      handleAddRootArrayItem(jsonType);
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
      const updatedParent: JsonObject = { ...parent, [newKeyName]: clonedValue };
      const newData = updateAtPath(props.data, parentPath, updatedParent);
      props.onChange([], newData as JsonValue);
    } else if (isArray(parent)) {
      const clonedValue = JSON.parse(JSON.stringify(value));
      const updatedParent: JsonArray = [...parent, clonedValue];
      const newData = updateAtPath(props.data, parentPath, updatedParent);
      props.onChange([], newData as JsonValue);
    }
  };

  return (
    <div class="font-mono text-sm overflow-auto max-h-full">
      <Show when={isObject(props.data) || isArray(props.data)}>
        <div class="group">
          <div class="flex items-center justify-between mb-2 pr-2">
            <span class="text-gray-500 text-xs uppercase tracking-wide">Tree View</span>
            <div class="relative">
              <button
                type="button"
                onClick={() => setShowTypeSelector(!showTypeSelector())}
                class="flex items-center gap-1 px-2 py-1 text-xs font-mono text-[var(--accent)] hover:bg-slate-700/50 rounded border border-slate-600 bg-slate-800"
                title={isArray(props.data) ? "Add item to array" : "Add property to object"}
              >
                + {isArray(props.data) ? "Add Item" : "Add Property"}
              </button>
              <Show when={showTypeSelector()}>
                <TypeSelector 
                  onSelect={handleRootTypeSelect} 
                  onClose={() => setShowTypeSelector(false)} 
                />
              </Show>
            </div>
          </div>
          <TreeNode
            keyName="root"
            value={props.data as JsonValue}
            path={[]}
            onChange={handleChange}
            onNodeClick={props.onNodeClick}
            onDuplicate={handleDuplicate}
            isLast={true}
          />
        </div>
      </Show>
      <Show when={!isObject(props.data) && !isArray(props.data)}>
        <div class="flex items-center gap-2">
          <ValueEditor value={props.data as JsonValue} path={[]} onChange={handleChange} />
          <span class="text-gray-500 text-sm">({typeof props.data})</span>
        </div>
      </Show>
    </div>
  );
}
