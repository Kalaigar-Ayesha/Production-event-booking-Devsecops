pipeline {
  agent any

  options {
    timestamps()
  }

  parameters {
    choice(name: 'PUSH_TARGET', choices: ['dockerhub', 'none'], description: 'Where to push images')
    string(name: 'DOCKER_IMAGE_NAMESPACE', defaultValue: 'your-dockerhub-user', description: 'Docker Hub username')
    string(name: 'IMAGE_TAG', defaultValue: 'latest', description: 'Image tag')
  }

  environment {
    API_IMAGE = "${params.DOCKER_IMAGE_NAMESPACE}/eventora-api:${params.IMAGE_TAG}"
    WEB_IMAGE = "${params.DOCKER_IMAGE_NAMESPACE}/eventora-web:${params.IMAGE_TAG}"
    TRIVY_SEVERITY = 'HIGH,CRITICAL'
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    // ✅ FIXED NODE ISSUE
    stage('Install + Build') {
      steps {
        script {
          docker.image('node:18').inside {
            sh '''
              npm ci
              npm run build
            '''
          }
        }
      }
    }

    // ✅ SONARQUBE
    stage('SAST (SonarQube)') {
      steps {
        withSonarQubeEnv('SonarQube') {
          sh '''
            docker run --rm \
              -v "$PWD:/usr/src" \
              sonarsource/sonar-scanner-cli:latest \
              -Dsonar.projectKey=eventora
          '''
        }
      }
    }

    stage('Dependency Scan') {
      steps {
        sh '''
          docker run --rm -v "$PWD:/app" node:18 sh -c "
            cd /app && npm audit --audit-level=high;
            cd client && npm audit --audit-level=high;
            cd ../server && npm audit --audit-level=high
          "
        '''
      }
    }

    stage('Filesystem Scan (Trivy)') {
      steps {
        sh '''
          docker run --rm \
            -v "$PWD:/workspace" \
            aquasec/trivy:latest fs /workspace \
            --severity HIGH,CRITICAL \
            --exit-code 1 \
            --no-progress
        '''
      }
    }

    stage('Secret Scan (Gitleaks)') {
      steps {
        sh '''
          docker run --rm \
            -v "$PWD:/repo" \
            zricethezav/gitleaks:latest \
            detect --source=/repo --redact --exit-code 1
        '''
      }
    }

    stage('Docker Build') {
      steps {
        sh '''
          docker build -t $API_IMAGE ./server
          docker build -t $WEB_IMAGE ./client
        '''
      }
    }

    stage('Image Scan (Trivy)') {
      steps {
        sh '''
          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy:latest image $API_IMAGE \
            --severity HIGH,CRITICAL \
            --exit-code 1 \
            --no-progress

          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy:latest image $WEB_IMAGE \
            --severity HIGH,CRITICAL \
            --exit-code 1 \
            --no-progress
        '''
      }
    }

    stage('Push to DockerHub') {
      when {
        expression { params.PUSH_TARGET == 'dockerhub' }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'USER', passwordVariable: 'PASS')]) {
          sh '''
            echo "$PASS" | docker login -u "$USER" --password-stdin
            docker push $API_IMAGE
            docker push $WEB_IMAGE
          '''
        }
      }
    }
  }

  post {
    always {
      sh 'docker logout || true'
      cleanWs()
    }
  }
}