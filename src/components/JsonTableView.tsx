import { createMemo, createSignal, For, Show } from "solid-js";

type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
type JsonObject = { [key: string]: JsonValue };
type JsonArray = JsonValue[];

type JsonType = "string" | "number" | "boolean" | "null" | "object" | "array";

interface Props {
  data: unknown;
  onChange: (path: string[], value: JsonValue) => void;
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

function flattenObject(obj: unknown, prefix = ""): Array<{ path: string; key: string; value: JsonValue; type: string }> {
  const result: Array<{ path: string; key: string; value: JsonValue; type: string }> = [];
  
  if (obj === null || obj === undefined) {
    return result;
  }
  
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      const path = prefix ? `${prefix}.${index}` : String(index);
      const key = prefix ? `${prefix}[${index}]` : String(index);
      
      if (typeof item === "object" && item !== null) {
        result.push(...flattenObject(item, path));
      } else {
        result.push({
          path,
          key,
          value: item,
          type: item === null ? "null" : typeof item,
        });
      }
    });
  } else if (typeof obj === "object") {
    Object.entries(obj as JsonObject).forEach(([k, v]) => {
      const path = prefix ? `${prefix}.${k}` : k;
      const key = prefix ? `${prefix}.${k}` : k;
      
      if (typeof v === "object" && v !== null) {
        result.push(...flattenObject(v, path));
      } else {
        result.push({
          path,
          key,
          value: v,
          type: v === null ? "null" : typeof v,
        });
      }
    });
  }
  
  return result;
}

function TableRow(props: { entry: { path: string; key: string; value: JsonValue; type: string }; onChange: (path: string[], value: JsonValue) => void }) {
  const [editing, setEditing] = createSignal(false);
  const [editValue, setEditValue] = createSignal("");
  
  const startEdit = () => {
    setEditValue(props.entry.value === null ? "null" : String(props.entry.value));
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
    
    props.onChange(props.entry.path.split("."), newValue);
    setEditing(false);
  };
  
  const colorClass = () => {
    switch (props.entry.type) {
      case "string": return "text-green-400";
      case "number": return "text-blue-400";
      case "boolean": return "text-purple-400";
      case "null": return "text-gray-500";
      default: return "text-white";
    }
  };
  
  return (
    <tr class="border-b border-slate-700 hover:bg-slate-800/50">
      <td class="py-2 px-3 text-yellow-300 font-mono text-sm">{props.entry.key}</td>
      <td class="py-2 px-3 font-mono text-sm">
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
            class="px-2 py-1 bg-slate-700 border border-sky-500 rounded text-white text-sm w-full focus:outline-none"
            autofocus
          />
        </Show>
        <Show when={!editing()}>
          <span
            class={`cursor-pointer hover:bg-slate-700 px-1 rounded ${colorClass()}`}
            onClick={startEdit}
          >
            <Show when={props.entry.type === "string"}>"{String(props.entry.value)}"</Show>
            <Show when={props.entry.type !== "string"}>{String(props.entry.value)}</Show>
          </span>
        </Show>
      </td>
      <td class="py-2 px-3 text-gray-500 text-xs">{props.entry.type}</td>
    </tr>
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

export default function JsonTableView(props: Props) {
  const [showTypeSelector, setShowTypeSelector] = createSignal(false);
  const flattened = createMemo(() => flattenObject(props.data));
  
  const isObject = (val: unknown): val is JsonObject => {
    return val !== null && typeof val === "object" && !Array.isArray(val);
  };
  
  const isArray = (val: unknown): val is JsonArray => {
    return Array.isArray(val);
  };
  
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
  
  const handleAddProperty = (jsonType: JsonType) => {
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

  const handleDuplicateEntry = () => {
    if (isArray(props.data)) {
      const currentArray = props.data as JsonArray;
      if (currentArray.length > 0) {
        const lastItem = currentArray[currentArray.length - 1];
        const clonedValue = JSON.parse(JSON.stringify(lastItem));
        const updatedArray: JsonArray = [...currentArray, clonedValue];
        props.onChange([], updatedArray as JsonValue);
      }
    }
  };
  
  return (
    <div class="overflow-auto max-h-full">
      <div class="flex items-center justify-between mb-2 pr-2">
        <span class="text-gray-500 text-xs uppercase tracking-wide">Table View</span>
        <Show when={isArray(props.data) && (props.data as JsonArray).length > 0}>
          <button
            type="button"
            onClick={handleDuplicateEntry}
            class="flex items-center gap-1 px-2 py-1 text-xs font-mono text-blue-400 hover:bg-slate-700/50 rounded border border-slate-600 bg-slate-800"
            title="Duplicate last entry"
          >
            ⧉ Duplicate Last Entry
          </button>
        </Show>
      </div>
      <table class="w-full text-left border-collapse">
        <thead class="sticky top-0 bg-slate-800">
          <tr class="border-b border-slate-600">
            <th class="py-2 px-3 text-gray-400 text-sm font-medium">Key</th>
            <th class="py-2 px-3 text-gray-400 text-sm font-medium">Value</th>
            <th class="py-2 px-3 text-gray-400 text-sm font-medium">Type</th>
          </tr>
        </thead>
        <tbody>
          <For each={flattened()}>
            {(entry) => (
              <TableRow entry={entry} onChange={handleChange} />
            )}
          </For>
        </tbody>
      </table>
      
      <Show when={flattened().length === 0}>
        <p class="text-gray-500 text-center py-4">No editable values</p>
      </Show>
      
      <div class="mt-2 pt-2 border-t border-slate-700 relative">
        <button
          type="button"
          onClick={() => setShowTypeSelector(!showTypeSelector())}
          class="flex items-center gap-1 px-3 py-2 text-sm font-mono text-[var(--accent)] hover:bg-slate-700/50 rounded"
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
  );
}
