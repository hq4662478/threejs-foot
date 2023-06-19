import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';

import {BOX_CONNECTIONS,  Objectron, ObjectronConfig , ResultsListener, ObjectronInterface, Results, Point2D, Point3D, LandmarkConnectionArray, ObjectDetectionList} from '@mediapipe/objectron';
import { Camera } from '@mediapipe/camera_utils';
import {drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';



function normalize_to_pixel_coordinates(normalized_x: number,
	normalized_y: number,
	image_width: number,
	image_height: number): number[] {
		const x_px = Math.min(Math.floor(normalized_x * image_width), image_width - 1);
		const y_px = Math.min(Math.floor(normalized_y * image_height), image_height - 1);
		return [x_px, y_px];
	}

const videoElement =
	document.getElementsByClassName('input_video')[0] as HTMLVideoElement;
const canvasElement =
	document.getElementsByClassName('output_canvas')[0] as HTMLCanvasElement;
const canvasCtx = canvasElement.getContext('2d')!;

videoElement.setAttribute('autoplay', '');
videoElement.setAttribute('muted', '');
videoElement.setAttribute('playsinline', '');

const frame_width = 1280;
const frame_height = 720;

const objectron = new Objectron({locateFile: (file) => {
	return `./objectron/${file}`;
}});

objectron.setOptions({
	modelName: 'Shoe',
	maxNumObjects: 5,
	minDetectionConfidence: 0.4,
	minTrackingConfidence: 0.99
});

const camera = new Camera(videoElement, {
	onFrame: async () => {

		await objectron.send({image: videoElement});
	},
	width: frame_width,
	height: frame_height
	});
	camera.start();

const num_objects = 2;

// init default foot point picking
let coord_temp: number[][] = [[-1, -1, -1]];
let coord_2_temp = [-1, -1, -1];
let x_center = -1;
let y_center = -1;

const ThreeScene: React.FC = () => {

    // function onResults(results: Results) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const [coord, setCoord] = useState<number[][]>();
	// const [coord_2, setCoord_2] = useState<number[]>();
	// const [z_coord, setZ_coord] = useState<number>();

	// let list_object_result: Point3D[];
	var temp_x: number = 0, temp_y: number = 0;
	var list_object_result: ObjectDetectionList = [];

	const onResults = (results: Results) => {
		list_object_result = [];
		// console.log("run result", results);
		canvasCtx.save();
		
		canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
		
		if (!!results.objectDetections) {
			// console.log("*************: ", results.objectDetections.length);
			
			if (results.objectDetections.length > num_objects) {
				const list_point = []
				for (const detectedObject of results.objectDetections) {
					const landmarks_temp: Point2D[] = detectedObject.keypoints.map(x => x.point2d);

					[temp_x, temp_y] = normalize_to_pixel_coordinates(landmarks_temp[2].x, landmarks_temp[2].y, frame_width, frame_height);
					list_point.push(temp_y);
					// console.log(temp_x, temp_y);
				}
				const  list_point_temp = list_point;
				list_point_temp.sort();
				list_object_result.push(results.objectDetections[list_point.indexOf(list_point_temp[-1])]);
			}
			else {
				list_object_result = results.objectDetections;
			}
			
			// reInit coordinates
			coord_temp = [];

			try {
				if (list_object_result.length > 0) {
					for (const detectedObject of list_object_result) {
						// Reformat key points information as landmarks, for easy drawing.
						// find center of foot
						const landmarks: Point2D[] = detectedObject.keypoints.map(x => x.point2d);
						const [temp_x1, temp_y1] = normalize_to_pixel_coordinates(landmarks[2].x, landmarks[2].y, frame_width, frame_height);
						const [temp_x2, temp_y2] = normalize_to_pixel_coordinates(landmarks[2].x, landmarks[2].y, frame_width, frame_height);

						x_center = Math.floor((temp_x1 + temp_x2)/2);
						y_center = Math.floor((temp_y1 + temp_y2)/2);

						// Draw bounding box.
						drawConnectors(canvasCtx, landmarks, BOX_CONNECTIONS, {color: '#FF0000'});
						// landmarks_3dpoint 
						const landmarks_3dpoint: Point3D[] = detectedObject.keypoints.map(x => x.point3d);
						
						// find distance camera phone and object
						const distance = parseFloat(((landmarks_3dpoint[2].z + landmarks_3dpoint[6].z)/2*(-1)).toFixed(4))

						coord_temp.push([x_center, y_center, distance])

					}

					setCoord(coord_temp);

				}
			} catch (e){
				console.log("Cannot read properties");
			}
		}
      canvasCtx.restore();
    }

    objectron.onResults(onResults);

    // render three scene views
    useEffect(() => {
		// console.log("useEffect", coord);
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(75, frame_width / frame_height, 0.1, 1000);
		camera.position.set(0, 0, 10);

		const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current! });
		renderer.setSize(frame_width, frame_height);

		const axesHelper = new THREE.AxesHelper(100);
		scene.add(axesHelper);
		// Create room geometry
		  const roomGeometry = new THREE.BoxGeometry(1280, 720, 10);
		  const roomMaterial = new THREE.MeshBasicMaterial({ color: 0x808080, side: THREE.BackSide });
		  const room = new THREE.Mesh(roomGeometry, roomMaterial);
		  scene.add(room);

		if (coord !== undefined){
			if (coord.length === 1){
				const point_x1 = ((coord[0][0] * 20)/1280) - 10; // scale -10 -> 10
				const point_y1 = ((coord[0][1] * 14)/1280) - 7; // scale -7 -> 7
				// const dis_p1 = (0.5 - (coord[0][2]))*10;
				const dis_p1 = (coord[0][2]*10)/0.45;

				// Create the point
				const pointMaterial1 = new THREE.PointsMaterial({
					size: 0.1, // Initial size of the point
					sizeAttenuation: false,
					vertexColors: true,
				  });

				const point1Geometry = new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(point_x1*(-1), point_y1*(-1), 0),
				]);

				// const point1Material = new THREE.PointsMaterial({ color: 0xff0000 });
				const point1 = new THREE.Points(point1Geometry, pointMaterial1);
				scene.add(point1);
				

				console.log("Distance: ", dis_p1);
				const distance1 = point1.position.distanceTo(camera.position);
					pointMaterial1.size = distance1 * 10;

					const animate = () => {
						requestAnimationFrame(animate);
						// camera.updateProjectionMatrix();
						const distance1 = point1.position.distanceTo(camera.position);
						pointMaterial1.size = distance1 * dis_p1;
						// point1.rotation.y += 0.01;
						renderer.render(scene, camera);
				  }; 
				  animate();

			}
			else if(coord.length === 2) {
				const point_x1 = ((coord[0][0] * 20)/1280) - 10; // scale -10 -> 10
				const point_y1 = ((coord[0][1] * 14)/1280) - 7; // scale -7 -> 7
				const dis_p1 = (coord[0][2]*10)/0.45;
				// Create the point
				const pointMaterial1 = new THREE.PointsMaterial({
					size: 0.1, // Initial size of the point
					sizeAttenuation: false,
					vertexColors: true,
				  });

				const pointGeometry1= new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(point_x1*(-1), point_y1*(-1), 0),
				]);
				// const point1Material = new THREE.PointsMaterial({ color: 0xff0000 });
				const point1 = new THREE.Points(pointGeometry1, pointMaterial1);
				scene.add(point1);


				const point_x2 = ((coord[1][0] * 20)/1280) - 10; // scale -10 -> 10
				const point_y2 = ((coord[1][1] * 14)/1280) - 7; // scale -7 -> 7
				const dis_p2 = (coord[1][2]*10)/0.45;
				// Create the point
				const pointMaterial2 = new THREE.PointsMaterial({
					size: 0.1, // Initial size of the point
					sizeAttenuation: false,
					vertexColors: true,
				  });

				const pointGeometry2 = new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(point_x2*(-1), point_y2*(-1), 0),
				]);
				// const pointMaterial2 = new THREE.PointsMaterial({ color: 0xff0000 });
				const point2 = new THREE.Points(pointGeometry2, pointMaterial2);
				scene.add(point2);

				console.log("Distance: ", dis_p1, dis_p2);


				const animate = () => {
					// camera.zoom *= 1.1; // Increase zoom level by 10%
					requestAnimationFrame(animate);
					// camera.updateProjectionMatrix();
					const distance1 = point1.position.distanceTo(camera.position);
					pointMaterial1.size = distance1 * dis_p1;
					const distance2 = point2.position.distanceTo(camera.position);
					pointMaterial2.size = distance2 * dis_p2; 
					// point1.rotation.y += 0.01;
					renderer.render(scene, camera);
			  }; 
			  animate();
			}
		// 	const animate = () => {
		// 		requestAnimationFrame(animate);
		// 		renderer.render(scene, camera);
		//   };
		//   animate();

	
		}

		const animate = () => {
			requestAnimationFrame(animate);
			renderer.render(scene, camera);
      	};


      	animate();

      return () => {
        renderer.dispose();
      };
    }, [coord]);

    return <canvas ref={canvasRef} />;
  };

  export default ThreeScene;
