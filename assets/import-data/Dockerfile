FROM --platform=linux/amd64 public.ecr.aws/docker/library/python:3.10
LABEL maintainer="Sathish H"
COPY requirements.txt ./
RUN pip install --upgrade pip
RUN pip install -r requirements.txt
COPY import_data.py ./
CMD ["python", "import_data.py"]