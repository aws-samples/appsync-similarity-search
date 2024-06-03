FROM --platform=linux/amd64 public.ecr.aws/lambda/python:3.12
LABEL maintainer="Sathish H"
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt
COPY query_product.py ${LAMBDA_TASK_ROOT}
CMD ["query_product.handler"]