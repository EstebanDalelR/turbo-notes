const PRESETS = [
  '#7a8450', '#8a6d3b', '#9c6b4a', '#5b6b7a',
  '#a14a4a', '#4a7a6a', '#6b4a7a', '#b1843e',
]

export function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (color: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {PRESETS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          title={c}
          className={`h-5 w-5 rounded-full border ${
            value.toLowerCase() === c ? 'ring-2 ring-offset-1 ring-sepia-600' : 'border-sepia-400/50'
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
      <label className="h-5 w-5 rounded-full border border-sepia-400/50 overflow-hidden cursor-pointer" title="Custom color">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 w-7 -translate-x-1 -translate-y-1 cursor-pointer"
        />
      </label>
    </div>
  )
}
