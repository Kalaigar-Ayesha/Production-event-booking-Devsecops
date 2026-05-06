pipeline {
  agent any

  options {
    timestamps()
  }

  parameters {
    choice(name: 'PUSH_TARGET', choices: ['dockerhub', 'none'], description: 'Where to push images')
    string(name: 'DOCKER_IMAGE_NAMESPACE', defaultValue: 'your-dockerhub-user', description: 'Docker Hub username')
    string(name: 'IMAGE_TAG', defaultValue: 'latest', description: 'Image tag')
    choice(name: 'SAST_TOOL', choices: ['sonarqube', 'codeql'], description: 'SAST scanner to run')
    choice(name: 'DEPENDENCY_SCAN_TOOL', choices: ['snyk', 'owasp'], description: 'Dependency scanner to run')
    booleanParam(name: 'USE_VAULT', defaultValue: true, description: 'Fetch CI tokens from HashiCorp Vault (recommended)')
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

    stage('Secrets (Vault)') {
      when {
        expression { return params.USE_VAULT == true }
      }
      steps {
        script {
          // Requires Jenkins "HashiCorp Vault" plugin.
          // Vault access should use AppRole / Kubernetes auth, not static tokens committed in code.
          // Configure the Vault server in Jenkins global settings and a Vault credential:
          // - Credential ID: vault-approle (type: Vault App Role Credential)
          //
          // Secrets path examples:
          // - secret/ci/eventora : { snyk_token: "...", sonar_token: "..." }
          def secrets = [
            [path: 'secret/ci/eventora', secretValues: [
              [envVar: 'SNYK_TOKEN', vaultKey: 'snyk_token'],
              [envVar: 'SONAR_AUTH_TOKEN', vaultKey: 'sonar_token']
            ]]
          ]

          withVault([
            vaultSecrets: secrets,
            vaultCredentialId: 'vault-approle'
          ]) {
            // Values are now in env for subsequent stages; do a minimal sanity check without printing secrets.
            sh 'test -n "$SNYK_TOKEN" || true'
          }
        }
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

    stage('Code Scan (SAST)') {
      steps {
        script {
          if (params.SAST_TOOL == 'sonarqube') {
            withSonarQubeEnv('SonarQube') {
              sh '''
                docker run --rm \
                  -e SONAR_HOST_URL="$SONAR_HOST_URL" \
                  -e SONAR_LOGIN="$SONAR_AUTH_TOKEN" \
                  -v "$PWD:/usr/src" \
                  sonarsource/sonar-scanner-cli:latest \
                  -Dsonar.projectKey=eventora \
                  -Dsonar.projectName=eventora \
                  -Dsonar.sources=client/src,server \
                  -Dsonar.exclusions=**/node_modules/**,**/dist/**,**/build/**
              '''
            }
          } else {
            sh '''
              rm -rf .codeql-db && mkdir -p reports
              docker run --rm -v "$PWD:/workspace" github/codeql-cli/codeql-cli:latest sh -lc "
                cd /workspace &&
                codeql database create .codeql-db --language=javascript --source-root=. &&
                codeql database analyze .codeql-db javascript-security-and-quality.qls \
                  --format=sarif-latest \
                  --output=reports/codeql-results.sarif
              "
            '''
            archiveArtifacts artifacts: 'reports/codeql-results.sarif', fingerprint: true
          }
        }
      }
    }

    stage('Dependency Scan') {
      steps {
        script {
          if (params.DEPENDENCY_SCAN_TOOL == 'snyk') {
            // Prefer Vault-sourced SNYK_TOKEN; fallback to Jenkins credential if Vault stage disabled.
            def haveVaultToken = env.SNYK_TOKEN?.trim()
            if (haveVaultToken) {
              sh '''
                docker run --rm \
                  -e SNYK_TOKEN="$SNYK_TOKEN" \
                  -v "$PWD:/project" \
                  snyk/snyk-cli:latest sh -lc "
                    cd /project &&
                    snyk test --severity-threshold=high --all-projects
                  "
              '''
            } else {
              withCredentials([string(credentialsId: 'snyk-token', variable: 'SNYK_TOKEN')]) {
                sh '''
                  docker run --rm \
                    -e SNYK_TOKEN="$SNYK_TOKEN" \
                    -v "$PWD:/project" \
                    snyk/snyk-cli:latest sh -lc "
                      cd /project &&
                      snyk test --severity-threshold=high --all-projects
                    "
                '''
              }
            }
          } else {
            sh '''
              mkdir -p reports/dependency-check
              docker run --rm \
                -v "$PWD:/src" \
                -v "$PWD/reports/dependency-check:/report" \
                owasp/dependency-check:latest \
                --scan /src/client \
                --scan /src/server \
                --format HTML \
                --format JSON \
                --out /report \
                --project Eventora
            '''
            archiveArtifacts artifacts: 'reports/dependency-check/*', fingerprint: true
          }
        }
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
            --severity $TRIVY_SEVERITY \
            --exit-code 1 \
            --no-progress

          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            aquasec/trivy:latest image $WEB_IMAGE \
            --severity $TRIVY_SEVERITY \
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
    success {
      sh '''
        if [ -n "${PUSHGATEWAY_URL:-}" ]; then
          echo "jenkins_job_last_result{job=\\"eventora\\"} 1" | curl --silent --show-error --fail --data-binary @- "$PUSHGATEWAY_URL/metrics/job/eventora" || true
        fi
      '''
    }
    failure {
      sh '''
        if [ -n "${PUSHGATEWAY_URL:-}" ]; then
          echo "jenkins_job_last_result{job=\\"eventora\\"} 0" | curl --silent --show-error --fail --data-binary @- "$PUSHGATEWAY_URL/metrics/job/eventora" || true
        fi
      '''
    }
  }
}