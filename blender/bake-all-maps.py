#!/usr/bin/env python3
"""
Curtain Wizard - Automatic Map Baking Script
=============================================
Bake'uje wszystkie mapy dla wszystkich pleat types w jednym przebiegu.

Użycie w Blender:
1. Upewnij się, że geometria pleats jest gotowa
2. Text Editor → Open → bake-all-maps.py
3. Alt+P (Run Script)
4. Poczekaj ~5-15 minut (zależy od GPU/CPU)
5. Sprawdź folder baked_maps/

Output:
  baked_maps/
    wave/
      pleatRamp.png
      normal.png
      ao.png
      variation.png
    flex/
      pleatRamp.png
      normal.png
      ao.png
      variation.png
    doubleFlex/
      pleatRamp.png
      normal.png
      ao.png
      variation.png
"""

import bpy
import os
import time
from pathlib import Path

# ==================== CONFIG ====================
PLEAT_TYPES = ['wave', 'flex', 'doubleFlex']
OUTPUT_DIR = "baked_maps"

BAKE_CONFIGS = {
    'pleatRamp': {
        'type': 'DIFFUSE',
        'pass_filter': {'DIRECT', 'INDIRECT'},  # Full lighting
        'bit_depth': 16,
        'file_format': 'PNG',
    },
    'normal': {
        'type': 'NORMAL',
        'pass_filter': set(),
        'bit_depth': 8,
        'file_format': 'PNG',
        'normal_space': 'TANGENT',  # Tangent space dla realtime
    },
    'ao': {
        'type': 'AO',
        'pass_filter': set(),
        'bit_depth': 16,
        'file_format': 'PNG',
        'ao_distance': 0.02,  # 2cm ray distance
    },
    'variation': {
        'type': 'EMIT',
        'pass_filter': set(),
        'bit_depth': 16,
        'file_format': 'PNG',
        # Artist must paint random grey per fold in vertex colors/texture
    },
}

# ==================== HELPERS ====================
def get_collection_objects(collection_name):
    """Get all mesh objects in collection"""
    coll = bpy.data.collections.get(f"Pleat_{collection_name}")
    if not coll:
        return []
    return [obj for obj in coll.objects if obj.type == 'MESH']

def select_only(obj):
    """Select single object"""
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

def get_bake_target_image(obj, map_name):
    """Find image texture node for bake target"""
    mat = obj.active_material
    if not mat or not mat.use_nodes:
        return None
    
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.label == map_name:
            return node.image
    return None

def ensure_output_dirs():
    """Create output folder structure"""
    blend_dir = bpy.path.abspath("//")
    if not blend_dir:
        raise RuntimeError("Save .blend file first!")
    
    base_path = Path(blend_dir) / OUTPUT_DIR
    
    for pleat_type in PLEAT_TYPES:
        pleat_path = base_path / pleat_type
        pleat_path.mkdir(parents=True, exist_ok=True)
    
    return base_path

# ==================== BAKE FUNCTIONS ====================
def bake_map(obj, map_name, config):
    """Bake single map type"""
    scene = bpy.context.scene
    
    # Get target image
    img = get_bake_target_image(obj, map_name)
    if not img:
        print(f"  ⚠ No image node found for {map_name}, skipping")
        return False
    
    # Select image node as active (bake target)
    mat = obj.active_material
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE' and node.image == img:
            mat.node_tree.nodes.active = node
            break
    
    # Configure bake settings
    scene.render.bake.use_pass_direct = 'DIRECT' in config.get('pass_filter', set())
    scene.render.bake.use_pass_indirect = 'INDIRECT' in config.get('pass_filter', set())
    scene.render.bake.use_pass_color = config['type'] in ['DIFFUSE', 'EMIT']
    
    if config['type'] == 'NORMAL':
        scene.render.bake.normal_space = config.get('normal_space', 'TANGENT')
    
    if config['type'] == 'AO':
        scene.world.light_settings.distance = config.get('ao_distance', 0.02)
    
    # BAKE!
    print(f"  → Baking {map_name}...", end=' ', flush=True)
    start = time.time()
    
    try:
        bpy.ops.object.bake(type=config['type'])
        elapsed = time.time() - start
        print(f"✓ ({elapsed:.1f}s)")
        return True
    except Exception as e:
        print(f"✗ Error: {e}")
        return False

def save_image(img, output_path, bit_depth=8):
    """Save image to disk with correct settings"""
    scene = bpy.context.scene
    
    # Configure file format
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB' if 'normal' in img.name else 'BW'
    scene.render.image_settings.color_depth = str(bit_depth)
    scene.render.image_settings.compression = 15  # PNG compression level
    
    # Save
    img.filepath_raw = str(output_path)
    img.file_format = 'PNG'
    img.save()
    
    file_size = output_path.stat().st_size / 1024  # KB
    print(f"    → Saved: {output_path.name} ({file_size:.1f} KB)")

# ==================== MAIN BAKE LOOP ====================
def bake_pleat_type(pleat_type, base_output_path):
    """Bake all maps for one pleat type"""
    print(f"\n{'='*60}")
    print(f"📦 BAKING: {pleat_type.upper()}")
    print(f"{'='*60}")
    
    objects = get_collection_objects(pleat_type)
    if not objects:
        print(f"  ⚠ No objects in Pleat_{pleat_type} collection, skipping")
        return
    
    # Join all objects into one (dla consistent bake)
    if len(objects) > 1:
        print(f"  → Joining {len(objects)} objects...")
        select_only(objects[0])
        for obj in objects[1:]:
            obj.select_set(True)
        bpy.ops.object.join()
        obj = bpy.context.object
    else:
        obj = objects[0]
    
    select_only(obj)
    
    # Ensure UVs exist
    if not obj.data.uv_layers:
        print("  → Creating UV map...")
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project()
        bpy.ops.object.mode_set(mode='OBJECT')
    
    # Bake each map
    output_dir = base_output_path / pleat_type
    
    for map_name, config in BAKE_CONFIGS.items():
        success = bake_map(obj, map_name, config)
        
        if success:
            img = get_bake_target_image(obj, map_name)
            if img:
                # Correct filename mapping
                filename_map = {
                    'pleatRamp': 'pleatRamp.png',
                    'normal': 'normal.png',
                    'ao': 'ao.png',
                    'variation': 'variation.png',
                }
                output_path = output_dir / filename_map[map_name]
                save_image(img, output_path, config['bit_depth'])

# ==================== VALIDATION ====================
def validate_scene():
    """Check if scene is ready for baking"""
    errors = []
    
    # Check if .blend is saved
    if not bpy.data.filepath:
        errors.append("Save .blend file first!")
    
    # Check if collections exist
    for pleat_type in PLEAT_TYPES:
        coll = bpy.data.collections.get(f"Pleat_{pleat_type}")
        if not coll:
            errors.append(f"Collection 'Pleat_{pleat_type}' not found")
    
    # Check render engine
    if bpy.context.scene.render.engine != 'CYCLES':
        errors.append("Render engine must be Cycles")
    
    if errors:
        print("\n❌ VALIDATION ERRORS:")
        for err in errors:
            print(f"  • {err}")
        return False
    
    return True

# ==================== POST-PROCESS ====================
def verify_tileability():
    """Print reminder to check seamless tiling"""
    print("\n" + "="*60)
    print("⚠️  TILEABILITY CHECK REQUIRED!")
    print("="*60)
    print("Open each texture in image editor and verify:")
    print("  1. No visible seams at edges (X/Y wrap)")
    print("  2. Pleat pattern repeats correctly")
    print("  3. No lighting discontinuities")
    print("\nTip: Use Photoshop Filter → Other → Offset (50%, 50%)")
    print("     to preview tiling artifacts.")

# ==================== MAIN ====================
def main():
    print("\n" + "="*60)
    print("🎨 CURTAIN WIZARD - AUTOMATIC MAP BAKING")
    print("="*60)
    
    # Validate
    if not validate_scene():
        return
    
    # Setup output
    try:
        base_output_path = ensure_output_dirs()
        print(f"\n✓ Output directory: {base_output_path}")
    except Exception as e:
        print(f"\n❌ Error creating output dirs: {e}")
        return
    
    # Bake all pleat types
    total_start = time.time()
    
    for pleat_type in PLEAT_TYPES:
        bake_pleat_type(pleat_type, base_output_path)
    
    total_elapsed = time.time() - total_start
    
    # Summary
    print("\n" + "="*60)
    print("✅ BAKING COMPLETE!")
    print("="*60)
    print(f"Total time: {total_elapsed/60:.1f} minutes")
    print(f"Output: {base_output_path}")
    
    verify_tileability()
    
    print("\n📁 Next: Copy textures to project:")
    print(f"   cp baked_maps/wave/* ../public/textures/canvas/wave/")
    print(f"   cp baked_maps/flex/* ../public/textures/canvas/flex/")
    print(f"   cp baked_maps/doubleFlex/* ../public/textures/canvas/doubleFlex/")

if __name__ == "__main__":
    main()
