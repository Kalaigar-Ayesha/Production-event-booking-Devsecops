pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
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

    stage('Install + Build') {
      steps {
        script {
          if (isUnix()) {
            sh '''
              set -e
              npm ci
              npm run build
            '''
          } else {
            bat '''
              npm ci
              npm run build
            '''
          }
        }
      }
    }

    // ✅ FIXED SONARQUBE STAGE
    stage('SAST (SonarQube)') {
      steps {
        withSonarQubeEnv('SonarQube') {
          script {
            if (isUnix()) {
              sh '''
                docker run --rm \
                  -v "$PWD:/usr/src" \
                  sonarsource/sonar-scanner-cli:latest \
                  -Dsonar.projectKey=eventora
              '''
            } else {
              bat '''
                docker run --rm ^
                  -v "%cd%:/usr/src" ^
                  sonarsource/sonar-scanner-cli:latest ^
                  -Dsonar.projectKey=eventora
              '''
            }
          }
        }
      }
    }

    stage('Dependency Scan (npm audit)') {
      steps {
        script {
          if (isUnix()) {
            sh '''
              npm audit --audit-level=high
              (cd client && npm audit --audit-level=high)
              (cd server && npm audit --audit-level=high)
            '''
          } else {
            bat '''
              npm audit --audit-level=high
              cd client && npm audit --audit-level=high && cd ..
              cd server && npm audit --audit-level=high && cd ..
            '''
          }
        }
      }
    }

    stage('Filesystem Scan (Trivy)') {
      steps {
        script {
          if (isUnix()) {
            sh '''
              docker run --rm \
                -v "$PWD:/workspace" \
                aquasec/trivy:latest fs /workspace \
                --severity HIGH,CRITICAL \
                --exit-code 1 \
                --no-progress
            '''
          } else {
            bat '''
              docker run --rm ^
                -v "%cd%:/workspace" ^
                aquasec/trivy:latest fs /workspace ^
                --severity HIGH,CRITICAL ^
                --exit-code 1 ^
                --no-progress
            '''
          }
        }
      }
    }

    stage('Secret Scan (Gitleaks)') {
      steps {
        script {
          if (isUnix()) {
            sh '''
              docker run --rm \
                -v "$PWD:/repo" \
                zricethezav/gitleaks:latest \
                detect --source=/repo --redact --verbose --exit-code 1
            '''
          } else {
            bat '''
              docker run --rm ^
                -v "%cd%:/repo" ^
                zricethezav/gitleaks:latest ^
                detect --source=/repo --redact --verbose --exit-code 1
            '''
          }
        }
      }
    }

    stage('Docker Build') {
      steps {
        script {
          if (isUnix()) {
            sh '''
              docker build -t $API_IMAGE ./server
              docker build -t $WEB_IMAGE ./client
            '''
          } else {
            bat '''
              docker build -t %API_IMAGE% .\\server
              docker build -t %WEB_IMAGE% .\\client
            '''
          }
        }
      }
    }

    stage('Image Scan (Trivy)') {
      steps {
        script {
          def scanCmdUnix = '''
            docker run --rm \
              -v /var/run/docker.sock:/var/run/docker.sock \
              aquasec/trivy:latest image IMAGE_NAME \
              --severity HIGH,CRITICAL \
              --exit-code 1 \
              --no-progress
          '''

          if (isUnix()) {
            sh scanCmdUnix.replace("IMAGE_NAME", env.API_IMAGE)
            sh scanCmdUnix.replace("IMAGE_NAME", env.WEB_IMAGE)
          } else {
            bat scanCmdUnix.replace("IMAGE_NAME", "%API_IMAGE%")
            bat scanCmdUnix.replace("IMAGE_NAME", "%WEB_IMAGE%")
          }
        }
      }
    }

    stage('Push to DockerHub') {
      when {
        expression { return params.PUSH_TARGET == 'dockerhub' }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'USER', passwordVariable: 'PASS')]) {
          script {
            if (isUnix()) {
              sh '''
                echo "$PASS" | docker login -u "$USER" --password-stdin
                docker push $API_IMAGE
                docker push $WEB_IMAGE
              '''
            } else {
              bat '''
                echo %PASS% | docker login -u %USER% --password-stdin
                docker push %API_IMAGE%
                docker push %WEB_IMAGE%
              '''
            }
          }
        }
      }
    }
  }

  post {
    always {
      script {
        if (isUnix()) {
          sh 'docker logout || true'
        } else {
          bat 'docker logout'
        }
      }
      cleanWs()
    }
  }
}