from dataclasses import dataclass, field
from typing import Any, Dict, List
from google import genai
import os
import json
import concurrent.futures
from PIL import Image, ExifTags
from google.genai.types import File
from pillow_heif import register_heif_opener
import piexif
import subprocess


# EXIF tag for 'ImageDescription' is 270
IMAGE_DESCRIPTION_TAG = 270 


@dataclass(slots=True)
class ImageContainer:
    """ A data container for image data """
    filepath: str
    img: Image.Image
    exif_dict: Dict[int, Any] | Image.Exif
    gemini_response : Dict[str, Any] = field(default_factory=dict)



class DataLoader:
    """ Loads in the image data and stores it and the metadata """

    def __init__(self, folder_path, objs) -> None:
        self.folder_path = folder_path
        self.objs = objs
        self.images: list[ImageContainer] = []
        self.root = "."

    def load_images_from_folder_path(self):
        """
        Returns
        -------
        List[ImageContainer]
            A list of ImageContainers containing the Image object and EXIF dictionary associated with every image in the folder_path (including subdirectories)
        """
        accepted_formats = ('heic', 'jpeg', 'jpg', 'png')
        for root, _, files in os.walk(self.folder_path):
            for name in files:
                if name.endswith(accepted_formats):
                    filepath = os.path.join(root, name)
                    img = Image.open(filepath)
                    # HEIF/HEIC files often store EXIF data in a different dictionary key
                    # For robust reading, check both the standard method and the 'exif' key
                    # if img.format in ('HEIF', 'HEIC') and 'exif' in img.info:
                    #     exif_bytes = img.info['exif']
                    #     exif_dict = piexif.load(exif_bytes)
                    # else:
                    # Standard JPEG/PNG/TIFF method
                    exif_dict = img.getexif()
                    if exif_dict is None:
                        # return "No EXIF data found."
                        return None
                    # TODO: Unify exif_dict formats
                    if exif_dict is not None: 
                        self.images.append(ImageContainer(filepath=filepath, img=img, exif_dict=exif_dict))
        return self.images

    def load_images_from_obj(self):
        """
        Returns
        -------
        List[ImageContainer]
            A list of ImageContainers containing the Image object and EXIF dictionary associated with every image in the folder_path (including subdirectories)
        """
        for i, obj in enumerate(self.objs):
            img = Image.open(obj)
            exif_dict = img.getexif()
            if exif_dict is None:
                # return "No EXIF data found."
                return None
            filepath = f"{self.root}/image{i}.jpg"
            img.save(filepath)
            self.images.append(ImageContainer(filepath=filepath, img=img, exif_dict=exif_dict))
        return self.images

    def destroy_data(self):
        """
        Delete the uploaded images
        """
        os.remove(f"{self.root}/*")



class ImageProcessor:
    """ A class for managing image processing functions """

    def __init__(self) -> None:
        # Register the opener once at the start of your application
        register_heif_opener()

        # Start the Gemini client
        self.client = genai.Client()

    def gemini_inference(self, images: List[ImageContainer]) -> List[ImageContainer]|None:
        """
        Uploads all images to Gemini, and then performs inference on them in one big batch

        Parameters
        ----------
        images : List[ImageContainer]
            A list of ImageContainer objects for each image you want to perform inference on

        Return
        ------
        List[ImageContainer] | None
            The same list of ImageContainer objects, but with updated gemini_response fields, or None if Gemini fails
        """

        def upload_single_file(img_cont: ImageContainer) -> File|None:
            """
            Uploads a single file and returns the uploaded File object.

            Parameters
            ----------
            img_cont: ImageContainer
                An ImageContainer object for the image to be uploaded

            Return
            ------
            File | None
                A File object for the uploaded image, or None if uploading fails
            """
            filepath = img_cont.filepath
            print(f"Uploading {filepath}...")
            try:
                uploaded_file = self.client.files.upload(file=filepath)
                print(f"Successfully uploaded: {uploaded_file.name}")
                return uploaded_file
            except Exception as e:
                print(f"Error uploading {filepath}: {e}")
                return None


        # Use ThreadPoolExecutor to run tasks concurrently
        with concurrent.futures.ThreadPoolExecutor() as executor:
            uploaded_images = executor.map(upload_single_file, images)
        
        # Filter out any failed uploads
        uploaded_images = [f for f in uploaded_images if f is not None]

        # Send prompt
        prompt = "Generate 3 one word tags, a short description sentence, and a filename consisting of 2 words in snake case (for example this_photo.jpg) followed by the file extension for each photo passed. Please return the results for each photo in JSON format with the fields 'name' for the filename 'tags' for the tags, and 'description' for the description. Output the analysis as a single JSON object. DO NOT include any markdown ```json tags. If two pictures are the same, still include JSON data for them, do not just omit it."
        contents = [image for image in uploaded_images]
        contents.append(prompt) # pyright: ignore - pure nonsense error
        response = self.client.models.generate_content(
            model="gemini-2.5-flash",
            contents=contents, # pyright: ignore - pure nonsense error
            config={
                "response_mime_type": "application/json", 
            },
        )
        try:
            # response.text is guaranteed to be valid JSON due to the config
            print(response.text)
            resp_dict = json.loads(response.text) # pyright: ignore - pure nonsense error
            # Assign gemini data to each image container object for use later
            for i, resp in enumerate(resp_dict):
                images[i].gemini_response = resp
            return images
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON: {e}")
            return None

    def save_updated_image(self, image_container: ImageContainer) -> None:
        """
        Updates the metadata and file name of a single image, saving it to disk

        Parameters
        ----------
        image_container: ImageContainer
            An ImageContainer object for the image to update
        """
        folderpath = os.path.split(image_container.filepath)[0]
        new_filepath = folderpath + '/' + image_container.gemini_response['name']

        # Now update the EXIF, XMP, and IPTC metadata 
        tag_string = ", ".join(image_container.gemini_response['tags'])
        # -sep ',': Sets the separator for keywords to a comma
        # -XMP:Subject+=: add to the list without overwriting existing tags
        # -overwrite_original: Saves changes directly to the original file
        command_list = [
            'exiftool', 
            '-sep', ',', 
            f'-EXIF:ImageDescription={image_container.gemini_response["description"]}',
            f'-XMP:Subject+={tag_string}', 
            f'-IPTC:Keywords+={tag_string}', # Also add to IPTC for maximum compatibility
            f'-filename={new_filepath}', 
            image_container.filepath
        ]

        try:
            subprocess.run(command_list, check=True, capture_output=True, text=True)
        except subprocess.CalledProcessError as e:
            print(f"Error during XMP write: {e.stderr}")
        except FileNotFoundError:
            print("Error: ExifTool not found.")


def main():
    image_folder = "/home/alexander/Pictures/"
    processor = ImageProcessor()
    images = DataLoader(image_folder).load_images()
    if images is not None:
        images = processor.gemini_inference(images)
    if images is not None:
        for image in images:
            print(f"Original name: {image.filepath}\nNew name: {image.gemini_response['name']}, tags: {image.gemini_response['tags']}, desc: {image.gemini_response['description']}")
            processor.save_updated_image(image)


if __name__ == "__main__":
    main()
