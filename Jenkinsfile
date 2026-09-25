pipeline {
  agent {
    kubernetes {
      defaultContainer 'jnlp'
      yaml '''
apiVersion: v1
kind: Pod
metadata:
  labels:
    app: jenkins-build-agent
spec:
  serviceAccountName: jenkins-admin
  restartPolicy: Never
  containers:
    - name: node
      image: node:20-bookworm
      command:
        - cat
      tty: true
    - name: python
      image: python:3.12-slim
      command:
        - cat
      tty: true
    - name: docker-cli
      image: docker:27-cli
      command:
        - cat
      tty: true
    - name: kaniko
      image: gcr.io/kaniko-project/executor:v1.23.2-debug
      command:
        - /busybox/cat
      tty: true
    - name: kubectl
      image: alpine/kubectl:1.37.0
      command:
        - /bin/sh
        - -c
        - cat
      tty: true
'''
    }
  }

  parameters {
    booleanParam(
      name: 'FULL_BUILD',
      defaultValue: false,
      description: 'Build and deploy all services'
    )
  }

  options {
    skipDefaultCheckout(true)
    timestamps()
    disableConcurrentBuilds()
  }

  environment {
    K8S_NAMESPACE = 'mycoder-dev'
    BACKEND_IMAGE_NAME = 'mycoder-backend'
    FRONTEND_IMAGE_NAME = 'mycoder-frontend'
    EMBEDDING_API_IMAGE_NAME = 'mycoder-embedding-api'
    FRONTEND_BUILD_API_BASE_URL = '/api/v1'
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Test Backend') {
      when {
        anyOf {
          expression { params.FULL_BUILD }
          changeset 'backend/**'
          changeset 'k8s/app/backend/**'
        }
      }
      steps {
        container('node') {
          dir('backend') {
            sh 'npm ci'
            sh 'npx eslint src'
            sh 'npm run test:ci -- --testTimeout=30000'
          }
        }
      }
    }

    stage('Build & Push Backend Image') {
      when {
        anyOf {
          expression { params.FULL_BUILD }
          changeset 'backend/**'
          changeset 'k8s/app/backend/**'
        }
      }
      steps {
        container('kaniko') {
          withCredentials([
            usernamePassword(
              credentialsId: 'docker-account',
              usernameVariable: 'DOCKERHUB_USERNAME',
              passwordVariable: 'DOCKERHUB_PASSWORD'
            )
          ]) {
            sh '''
              set -eu
              mkdir -p /kaniko/.docker
              AUTH="$(printf '%s:%s' "$DOCKERHUB_USERNAME" "$DOCKERHUB_PASSWORD" | base64 | tr -d '\\n')"
              printf '{"auths":{"https://index.docker.io/v1/":{"auth":"%s"}}}' "$AUTH" > /kaniko/.docker/config.json

              /kaniko/executor \
                --context="${WORKSPACE}/backend" \
                --dockerfile="${WORKSPACE}/backend/Dockerfile" \
                --destination="docker.io/${DOCKERHUB_USERNAME}/${BACKEND_IMAGE_NAME}:${BUILD_NUMBER}" \
                --destination="docker.io/${DOCKERHUB_USERNAME}/${BACKEND_IMAGE_NAME}:latest" \
                --cache=true \
                --cache-repo="docker.io/${DOCKERHUB_USERNAME}/${BACKEND_IMAGE_NAME}-cache"
            '''
          }
        }
      }
    }

    stage('Test Frontend') {
      when {
        anyOf {
          expression { params.FULL_BUILD }
          changeset 'frontend/**'
          changeset 'k8s/app/frontend/**'
        }
      }
      steps {
        container('node') {
          dir('frontend') {
            sh 'npm ci'
            sh 'npm run lint'
            sh 'npm run build'
          }
        }
      }
    }

    stage('Build & Push Frontend Image') {
      when {
        anyOf {
          expression { params.FULL_BUILD }
          changeset 'frontend/**'
          changeset 'k8s/app/frontend/**'
        }
      }
      steps {
        container('kaniko') {
          withCredentials([
            usernamePassword(
              credentialsId: 'docker-account',
              usernameVariable: 'DOCKERHUB_USERNAME',
              passwordVariable: 'DOCKERHUB_PASSWORD'
            )
          ]) {
            sh '''
              set -eu
              mkdir -p /kaniko/.docker
              AUTH="$(printf '%s:%s' "$DOCKERHUB_USERNAME" "$DOCKERHUB_PASSWORD" | base64 | tr -d '\\n')"
              printf '{"auths":{"https://index.docker.io/v1/":{"auth":"%s"}}}' "$AUTH" > /kaniko/.docker/config.json

              /kaniko/executor \
                --context="${WORKSPACE}/frontend" \
                --dockerfile="${WORKSPACE}/frontend/Dockerfile" \
                --build-arg="VITE_API_BASE_URL=${FRONTEND_BUILD_API_BASE_URL}" \
                --destination="docker.io/${DOCKERHUB_USERNAME}/${FRONTEND_IMAGE_NAME}:${BUILD_NUMBER}" \
                --destination="docker.io/${DOCKERHUB_USERNAME}/${FRONTEND_IMAGE_NAME}:latest" \
                --cache=true \
                --cache-repo="docker.io/${DOCKERHUB_USERNAME}/${FRONTEND_IMAGE_NAME}-cache"
            '''
          }
        }
      }
    }

    stage('Test Embedding API') {
      when {
        anyOf {
          expression { params.FULL_BUILD }
          changeset 'embedding-api/**'
        }
      }
      steps {
        container('python') {
          dir('embedding-api') {
            sh 'python -m compileall -q app'
          }
        }
      }
    }

    stage('Build & Push Embedding API Image') {
      when {
        anyOf {
          expression { params.FULL_BUILD }
          changeset 'embedding-api/**'
        }
      }
      steps {
        container('kaniko') {
          withCredentials([
            usernamePassword(
              credentialsId: 'docker-account',
              usernameVariable: 'DOCKERHUB_USERNAME',
              passwordVariable: 'DOCKERHUB_PASSWORD'
            )
          ]) {
            sh '''
              set -eu
              mkdir -p /kaniko/.docker
              AUTH="$(printf '%s:%s' "$DOCKERHUB_USERNAME" "$DOCKERHUB_PASSWORD" | base64 | tr -d '\\n')"
              printf '{"auths":{"https://index.docker.io/v1/":{"auth":"%s"}}}' "$AUTH" > /kaniko/.docker/config.json

              /kaniko/executor \
                --context="${WORKSPACE}/embedding-api" \
                --dockerfile="${WORKSPACE}/embedding-api/Dockerfile" \
                --destination="docker.io/${DOCKERHUB_USERNAME}/${EMBEDDING_API_IMAGE_NAME}:${BUILD_NUMBER}" \
                --destination="docker.io/${DOCKERHUB_USERNAME}/${EMBEDDING_API_IMAGE_NAME}:latest" \
                --cache=true \
                --cache-repo="docker.io/${DOCKERHUB_USERNAME}/${EMBEDDING_API_IMAGE_NAME}-cache"
            '''
          }
        }
      }
    }

    stage('Deploy Backend') {
      when {
        anyOf {
          expression { params.FULL_BUILD }
          changeset 'backend/**'
          changeset 'k8s/app/backend/**'
        }
      }
      steps {
        container('kubectl') {
          withCredentials([
            usernamePassword(
              credentialsId: 'docker-account',
              usernameVariable: 'DOCKERHUB_USERNAME',
              passwordVariable: 'DOCKERHUB_PASSWORD'
            )
          ]) {
            sh '''
              set -eu
              kubectl apply -f k8s/app/backend/configmap.yaml
              kubectl apply -f k8s/app/backend/deployment.yaml
              kubectl -n "$K8S_NAMESPACE" set image deployment/mycoder-backend \
                backend="docker.io/${DOCKERHUB_USERNAME}/${BACKEND_IMAGE_NAME}:${BUILD_NUMBER}"
              kubectl -n "$K8S_NAMESPACE" rollout status deployment/mycoder-backend --timeout=180s
            '''
          }
        }
      }
    }

    stage('Deploy Frontend') {
      when {
        anyOf {
          expression { params.FULL_BUILD }
          changeset 'frontend/**'
          changeset 'k8s/app/frontend/**'
        }
      }
      steps {
        container('kubectl') {
          withCredentials([
            usernamePassword(
              credentialsId: 'docker-account',
              usernameVariable: 'DOCKERHUB_USERNAME',
              passwordVariable: 'DOCKERHUB_PASSWORD'
            )
          ]) {
            sh '''
              set -eu
              kubectl apply -f k8s/app/frontend/deployment.yaml
              kubectl -n "$K8S_NAMESPACE" set image deployment/mycoder-frontend \
                frontend="docker.io/${DOCKERHUB_USERNAME}/${FRONTEND_IMAGE_NAME}:${BUILD_NUMBER}"
              kubectl -n "$K8S_NAMESPACE" rollout status deployment/mycoder-frontend --timeout=180s
            '''
          }
        }
      }
    }

    stage('Deploy Embedding API') {
      when {
        anyOf {
          expression { params.FULL_BUILD }
          changeset 'embedding-api/**'
        }
      }
      steps {
        container('kubectl') {
          withCredentials([
            usernamePassword(
              credentialsId: 'docker-account',
              usernameVariable: 'DOCKERHUB_USERNAME',
              passwordVariable: 'DOCKERHUB_PASSWORD'
            )
          ]) {
            sh '''
              set -eu
              kubectl apply -f k8s/app/embedding-api/deployment.yaml
              kubectl -n "$K8S_NAMESPACE" set image deployment/mycoder-embedding-api \
                download-model="docker.io/${DOCKERHUB_USERNAME}/${EMBEDDING_API_IMAGE_NAME}:${BUILD_NUMBER}" \
                embedding-api="docker.io/${DOCKERHUB_USERNAME}/${EMBEDDING_API_IMAGE_NAME}:${BUILD_NUMBER}"
              kubectl -n "$K8S_NAMESPACE" rollout status deployment/mycoder-embedding-api --timeout=600s
            '''
          }
        }
      }
    }
  }
}
