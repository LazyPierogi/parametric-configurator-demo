#!/usr/bin/env python3
"""
Curtain Wizard - Blender Scene Setup Script
============================================
Automatycznie tworzy scenę do bake'owania pleat textures.

Użycie w Blender:
1. Text Editor → Open → setup-curtain-scene.py
2. Alt+P (Run Script)
3. Scena gotowa do modelowania fałd!

Requirements: Blender 3.6+ (Cycles)
"""

import bpy
import math
import os
from mathutils import Vector

# ==================== CONFIG ====================
TEXTURE_WIDTH = 1024   # horizontal (pleat cycle)
TEXTURE_HEIGHT = 2048  # vertical (curtain drop)

CURTAIN_PHYSICAL_WIDTH = 1.0   # metry (dla scale reference)
CURTAIN_PHYSICAL_HEIGHT = 2.0  # metry

OUTPUT_DIR = "//baked_maps"  # relative to .blend file
PLEAT_TYPES = ['wave', 'flex', 'doubleFlex']

# ==================== CLEANUP ====================
def clean_scene():
    """Usuń wszystkie obiekty, kamery, światła"""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    
    # Usuń orphaned data
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)
    for block in bpy.data.images:
        if block.users == 0:
            bpy.data.images.remove(block)

# ==================== CAMERA ====================
def setup_camera():
    """Orthographic camera - zero perspective distortion"""
    bpy.ops.object.camera_add(location=(0, -3, 1))
    cam = bpy.context.object
    cam.name = "Camera_Ortho_Bake"
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = CURTAIN_PHYSICAL_HEIGHT * 1.1  # slight margin
    
    # Point at curtain center
    cam.rotation_euler = (math.radians(90), 0, 0)
    
    # Set as active camera
    bpy.context.scene.camera = cam
    
    return cam

# ==================== LIGHTING ====================
def setup_lighting():
    """Neutral HDRI + Sun dla realistic shadows"""
    world = bpy.context.scene.world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    nodes.clear()
    
    # Background (neutral grey HDRI substitute)
    bg = nodes.new(type='ShaderNodeBackground')
    bg.inputs['Color'].default_value = (0.5, 0.5, 0.5, 1.0)  # 50% grey
    bg.inputs['Strength'].default_value = 0.8
    
    output = nodes.new(type='ShaderNodeOutputWorld')
    world.node_tree.links.new(bg.outputs['Background'], output.inputs['Surface'])
    
    # Sun light (45° angle dla cieni)
    bpy.ops.object.light_add(type='SUN', location=(2, -2, 3))
    sun = bpy.context.object
    sun.name = "Sun_Main"
    sun.data.energy = 2.5
    sun.data.angle = math.radians(5)  # soft shadows
    sun.rotation_euler = (math.radians(45), 0, math.radians(30))
    
    return sun

# ==================== RENDER SETTINGS ====================
def setup_render():
    """Cycles with optimal bake settings"""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'GPU'  # zmień na 'CPU' jeśli brak GPU
    scene.cycles.samples = 512
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    
    # Resolution = texture size
    scene.render.resolution_x = TEXTURE_WIDTH
    scene.render.resolution_y = TEXTURE_HEIGHT
    scene.render.resolution_percentage = 100
    
    # Color management
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    scene.sequencer_colorspace_settings.name = 'Linear'
    
    # Bake settings
    scene.render.bake.use_clear = True
    scene.render.bake.margin = 2  # prevent edge bleeding
    scene.render.bake.use_selected_to_active = False

# ==================== BASE PLANE ====================
def create_base_plane():
    """Płaszczyzna do unwrap (perfect UV square)"""
    bpy.ops.mesh.primitive_plane_add(
        size=1,
        location=(0, 0, CURTAIN_PHYSICAL_HEIGHT / 2)
    )
    plane = bpy.context.object
    plane.name = "Curtain_BasePlane"
    
    # Scale do physical dimensions
    plane.scale.x = CURTAIN_PHYSICAL_WIDTH
    plane.scale.z = CURTAIN_PHYSICAL_HEIGHT
    bpy.ops.object.transform_apply(scale=True)
    
    # Perfect UV unwrap (0,0)→(1,1)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.unwrap(method='ANGLE_BASED', margin=0.0)
    bpy.ops.object.mode_set(mode='OBJECT')
    
    return plane

# ==================== MATERIAL SETUP ====================
def setup_bake_material(obj, pleat_type):
    """Material z Image Texture nodes dla bake"""
    mat = bpy.data.materials.new(name=f"Mat_Bake_{pleat_type}")
    mat.use_nodes = True
    obj.data.materials.append(mat)
    
    nodes = mat.node_tree.nodes
    nodes.clear()
    
    # Principled BSDF (dla Diffuse/AO bake)
    bsdf = nodes.new(type='ShaderNodeBsdfPrincipled')
    bsdf.location = (0, 0)
    bsdf.inputs['Base Color'].default_value = (0.8, 0.8, 0.8, 1.0)  # neutral grey
    bsdf.inputs['Roughness'].default_value = 0.6
    
    output = nodes.new(type='ShaderNodeOutputMaterial')
    output.location = (400, 0)
    mat.node_tree.links.new(bsdf.outputs['BSDF'], output.inputs['Surface'])
    
    # Image Texture nodes (dla bake targets)
    bake_maps = {
        'pleatRamp': (TEXTURE_WIDTH, TEXTURE_HEIGHT, True),   # 16-bit
        'normal': (TEXTURE_WIDTH, TEXTURE_HEIGHT, False),     # 8-bit RGB
        'ao': (TEXTURE_WIDTH, TEXTURE_HEIGHT, True),          # 16-bit
        'variation': (TEXTURE_WIDTH, TEXTURE_HEIGHT, True),   # 16-bit
    }
    
    y_offset = 300
    for map_name, (w, h, is_float) in bake_maps.items():
        img = bpy.data.images.new(
            name=f"{pleat_type}_{map_name}",
            width=w,
            height=h,
            alpha=False,
            float_buffer=is_float
        )
        img.colorspace_settings.name = 'Linear' if is_float else 'sRGB'
        
        tex_node = nodes.new(type='ShaderNodeTexImage')
        tex_node.image = img
        tex_node.location = (-400, y_offset)
        tex_node.label = map_name
        y_offset -= 350

# ==================== COLLECTIONS ====================
def setup_collections():
    """Organize scene by pleat type"""
    for pleat_type in PLEAT_TYPES:
        coll = bpy.data.collections.new(name=f"Pleat_{pleat_type}")
        bpy.context.scene.collection.children.link(coll)

# ==================== MAIN ====================
def main():
    print("="*60)
    print("CURTAIN WIZARD - Blender Scene Setup")
    print("="*60)
    
    clean_scene()
    setup_render()
    setup_camera()
    setup_lighting()
    setup_collections()
    
    # Create output directory
    blend_dir = bpy.path.abspath("//")
    if blend_dir:
        out_path = os.path.join(blend_dir, "baked_maps")
        os.makedirs(out_path, exist_ok=True)
        print(f"✓ Output directory: {out_path}")
    
    print("\n" + "="*60)
    print("✓ Scene ready!")
    print("="*60)
    print("\nNext steps:")
    print("1. Model pleats in each collection (wave/flex/doubleFlex)")
    print("2. Run 'bake-all-maps.py' to export textures")
    print("3. Check 'baked_maps/' folder for PNGs")
    print("\nSee BLENDER-WORKFLOW.md for detailed instructions.")

if __name__ == "__main__":
    main()
