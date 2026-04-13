pipeline {
  agent any

  options {
    timestamps()
    ansiColor('xterm')
    skipDefaultCheckout(false)
  }

  parameters {
    choice(name: 'PUSH_TARGET', choices: ['dockerhub', 'none'], description: 'Where to push images')
    string(name: 'DOCKER_IMAGE_NAMESPACE', defaultValue: 'your-dockerhub-user', description: 'Docker Hub namespace/user')
    string(name: 'IMAGE_TAG', defaultValue: 'latest', description: 'Image tag (e.g. build number, git sha)')
  }

  environment {
    // SonarQube (optional): set these in Jenkins Credentials/Env to enable SAST stage
    SONAR_HOST_URL = "${env.SONAR_HOST_URL}"
    SONAR_TOKEN    = "${env.SONAR_TOKEN}"

    // Image names (we publish two: API and Web)
    API_IMAGE = "${params.DOCKER_IMAGE_NAMESPACE}/eventora-api:${params.IMAGE_TAG}"
    WEB_IMAGE = "${params.DOCKER_IMAGE_NAMESPACE}/eventora-web:${params.IMAGE_TAG}"

    // Security gate severity
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
              set -euo pipefail
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

    stage('SAST (Code Security)') {
      when {
        expression { return env.SONAR_HOST_URL?.trim() && env.SONAR_TOKEN?.trim() }
      }
      steps {
        script {
          def scannerCmd = """
            docker run --rm \
              -e SONAR_HOST_URL="${env.SONAR_HOST_URL}" \
              -e SONAR_LOGIN="${env.SONAR_TOKEN}" \
              -v "${pwd()}:/usr/src" \
              sonarsource/sonar-scanner-cli:latest
          """.trim()

          if (isUnix()) {
            sh """
              set -euo pipefail
              ${scannerCmd}
            """
          } else {
            // Windows Docker Desktop supports volume mounts via absolute path; pwd() is absolute in Jenkins
            bat "${scannerCmd}"
          }
        }
      }
    }

    stage('Dependency Scan') {
      steps {
        script {
          if (isUnix()) {
            sh '''
              set -euo pipefail
              # npm audit (fails build on high/critical)
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

          // Trivy filesystem scan (repo-level)
          def trivyFsCmd = """
            docker run --rm \
              -v "${pwd()}:/workspace" \
              aquasec/trivy:latest fs /workspace \
              --security-checks vuln,config,secret \
              --severity ${env.TRIVY_SEVERITY} \
              --exit-code 1 \
              --no-progress
          """.trim()

          if (isUnix()) {
            sh """
              set -euo pipefail
              ${trivyFsCmd}
            """
          } else {
            bat "${trivyFsCmd}"
          }
        }
      }
    }

    stage('Secret Detection (Gitleaks)') {
      steps {
        script {
          def gitleaksCmd = """
            docker run --rm \
              -v "${pwd()}:/repo" \
              zricethezav/gitleaks:latest \
              detect --source=/repo --redact --verbose --exit-code 1
          """.trim()

          if (isUnix()) {
            sh """
              set -euo pipefail
              ${gitleaksCmd}
            """
          } else {
            bat "${gitleaksCmd}"
          }
        }
      }
    }

    stage('Docker Build') {
      steps {
        script {
          if (isUnix()) {
            sh """
              set -euo pipefail
              docker build -t "${env.API_IMAGE}" ./server
              docker build -t "${env.WEB_IMAGE}" ./client
            """
          } else {
            bat """
              docker build -t "${env.API_IMAGE}" .\\server
              docker build -t "${env.WEB_IMAGE}" .\\client
            """
          }
        }
      }
    }

    stage('Image Scan (Trivy)') {
      steps {
        script {
          def scan = { img ->
            def cmd = """
              docker run --rm \
                -v /var/run/docker.sock:/var/run/docker.sock \
                aquasec/trivy:latest image "${img}" \
                --severity ${env.TRIVY_SEVERITY} \
                --exit-code 1 \
                --no-progress
            """.trim()

            if (isUnix()) {
              sh """
                set -euo pipefail
                ${cmd}
              """
            } else {
              // On Windows agents this usually requires a Linux Docker engine exposing /var/run/docker.sock;
              // prefer running this pipeline on a Linux Docker-capable agent.
              bat "${cmd}"
            }
          }

          scan(env.API_IMAGE)
          scan(env.WEB_IMAGE)
        }
      }
    }

    stage('Push Image') {
      when {
        expression { return params.PUSH_TARGET == 'dockerhub' }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
          script {
            if (isUnix()) {
              sh """
                set -euo pipefail
                echo "$DOCKERHUB_PASS" | docker login -u "$DOCKERHUB_USER" --password-stdin
                docker push "${env.API_IMAGE}"
                docker push "${env.WEB_IMAGE}"
              """
            } else {
              bat """
                echo %DOCKERHUB_PASS% | docker login -u %DOCKERHUB_USER% --password-stdin
                docker push "${env.API_IMAGE}"
                docker push "${env.WEB_IMAGE}"
              """
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
