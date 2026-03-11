import sys

# Read file
filepath = 'src/app/[locale]/dashboard/[role]/yachts/[id]/page.tsx'
with open(filepath, 'r') as f:
    lines = f.readlines()

start_conflict = -1
for i, line in enumerate(lines):
    if line.startswith('<<<<<<< HEAD'):
        start_conflict = i
        break

if start_conflict == -1:
    print("Conflict not found")
    sys.exit(0)

# Found it! The block to replace:
# From <<<<<<< HEAD (line 3357 roughly)
# To where the conflict ends plus the duplicated nodes.
# Let's find the `>>>>>>> `
end_conflict = -1
for i in range(start_conflict, len(lines)):
    if lines[i].startswith('>>>>>>>'):
        end_conflict = i
        break

# After the conflict marker, there is a duplicated block.
# We'll search for the next `                                          {/* Quality label */}`
# and replace everything from start_conflict to just before that line.
end_replace = -1
for i in range(end_conflict, len(lines)):
    if '{/* Quality label */}' in lines[i]:
        end_replace = i
        break

if start_conflict != -1 and end_replace != -1:
    # Build desired replacement block
    replacement = """                              return (
                                <Draggable key={img.id} draggableId={`pipeline-image-${img.id}`} index={index}>
                                  {(dragProvided) => (
                                    <div
                                      ref={dragProvided.innerRef}
                                      {...dragProvided.draggableProps}
                                      className={cn(
                                        "relative group bg-white border shadow-sm overflow-hidden rounded-xl",
                                        img.status === "approved"
                                          ? "border-emerald-300 ring-1 ring-emerald-200"
                                          : img.status === "ready_for_review"
                                            ? "border-amber-300"
                                            : img.status === "processing"
                                              ? "border-blue-200"
                                              : "border-red-300"
                                      )}
                                    >
                                      {/* Image */}
                                      <div className="aspect-square relative flex bg-slate-100 overflow-hidden">
                                        <img
                                          key={`img-${img.id}-${img.thumb_full_url || img.optimized_url || img.full_url || img.url || img.original_temp_url}`}
                                          src={
                                            img.thumb_full_url ||
                                            img.optimized_url ||
                                            img.full_url ||
                                            img.url ||
                                            img.original_temp_url ||
                                            PLACEHOLDER_IMAGE
                                          }
                                          alt={img.original_name || `Yacht image ${index + 1}`}
                                          onClick={() => setSelectedLightboxImageId(img.id)}
                                          className={cn(
                                            "w-full h-full cursor-zoom-in object-cover transition-opacity",
                                            img.enhancement_method === "pending" &&
                                            "opacity-80 grayscale-[0.2]",
                                            img.status === "processing" && "opacity-60"
                                          )}
                                          onError={handleImageError}
                                        />

                                        {/* Loading Overlay for Processing */}
                                        {img.status === "processing" && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] z-10">
                                            <Loader2 size={24} className="animate-spin text-blue-600" />
                                          </div>
                                        )}
                                      </div>

                                      {/* Status badge */}
                                      <div
                                        className={`absolute top-2 left-2 ${sc.bg} ${sc.text} text-[9px] font-bold px-2 py-1 rounded-md shadow-md z-20`}
                                      >
                                        {sc.label}
                                      </div>

                                      <div
                                        {...dragProvided.dragHandleProps}
                                        className="absolute right-2 bottom-2 z-20 flex h-8 w-8 cursor-grab items-center justify-center rounded-full bg-white/90 text-slate-600 shadow-md backdrop-blur active:cursor-grabbing"
                                        title="Drag to reorder"
                                      >
                                        <GripVertical size={14} />
                                      </div>
"""
    new_lines = lines[:start_conflict] + [replacement] + lines[end_replace:]
    with open(filepath, 'w') as f:
        f.writelines(new_lines)
    print("Conflict resolved natively via Python script.")
else:
    print("Could not find the bounds.")
