import torch
import numpy as np
import trimesh

class SMPLMeasurer:
    def __init__(self):

        self.landmarks = {
            'l_shoulder': 412,  
            'r_shoulder': 5419, 
            'l_hip': 1,         
            'r_hip': 2,         
            'l_wrist': 2193,    
            'r_wrist': 5595,    
            'l_elbow': 1611,    
            'r_elbow': 5136,    
            'l_ankle': 3318,    
            'r_ankle': 6323,    
            
            'chest_pt': 3021,   
            'waist_pt': 3500    
        }

    def measure(self, vertices, faces, user_height_cm):

        mesh_height = vertices[:, 1].max() - vertices[:, 1].min()
        target_height_m = user_height_cm / 100.0
        scale_factor = target_height_m / mesh_height
        
    
        v_scaled = vertices * scale_factor
        
        
        mesh = trimesh.Trimesh(vertices=v_scaled, faces=faces, process=False)

      
        def dist(idx1, idx2):
            p1 = v_scaled[idx1]
            p2 = v_scaled[idx2]
            return np.linalg.norm(p1 - p2)

        shoulder_width = dist(self.landmarks['l_shoulder'], self.landmarks['r_shoulder']) * 100
        
        waist_width = dist(self.landmarks['l_hip'], self.landmarks['r_hip']) * 100


        l_arm = dist(self.landmarks['l_shoulder'], self.landmarks['l_elbow']) + \
                dist(self.landmarks['l_elbow'], self.landmarks['l_wrist'])
        r_arm = dist(self.landmarks['r_shoulder'], self.landmarks['r_elbow']) + \
                dist(self.landmarks['r_elbow'], self.landmarks['r_wrist'])
        arm_length = (l_arm + r_arm) / 2 * 100


        l_leg = abs(v_scaled[self.landmarks['l_hip']][1] - v_scaled[self.landmarks['l_ankle']][1])
        r_leg = abs(v_scaled[self.landmarks['r_hip']][1] - v_scaled[self.landmarks['r_ankle']][1])
        leg_length = (l_leg + r_leg) / 2 * 100

  
        def get_circumference(landmark_idx):
            
            h = v_scaled[landmark_idx][1]

            slice_res = mesh.section(plane_origin=[0, h, 0], plane_normal=[0, 1, 0])
            
            if slice_res:
                return slice_res.length * 100
            return 0.0

        chest_circ = get_circumference(self.landmarks['chest_pt'])
        waist_circ = get_circumference(self.landmarks['waist_pt'])

        return {
            "shoulder_width": round(shoulder_width, 1),
            "waist_width": round(waist_width, 1),
            "arm_length": round(arm_length, 1),
            "leg_length": round(leg_length, 1),
            "estimated_chest_circumference": round(chest_circ, 1),
            "estimated_waist_circumference": round(waist_circ, 1),
        }